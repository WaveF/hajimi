use crate::commands::{SearchOptionsPayload, SearchState, open_path_impl, reveal_in_finder_impl};
use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, BufRead, BufReader, BufWriter, Write},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::Duration,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const MAX_LINE_BYTES: usize = 1024 * 1024;
const MAX_RESULTS: usize = 500;
const MCP_PROTOCOL_VERSION: &str = "2025-06-18";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConnectionInfo {
    pub available: bool,
    pub discovery_path: String,
    pub executable_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveryFile {
    version: u8,
    transport: String,
    endpoint: String,
    token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgeRequest {
    #[serde(default)]
    id: Value,
    token: String,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgeResponse {
    id: Value,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct McpSearchFile {
    path: String,
    node_type: Option<u8>,
    size: Option<i64>,
    created_at: Option<u32>,
    modified_at: Option<u32>,
}

struct BridgeRuntime {
    app_handle: AppHandle,
    token: String,
    stop: AtomicBool,
}

pub struct McpBridge {
    runtime: Arc<BridgeRuntime>,
    discovery_path: PathBuf,
    endpoint_path: Option<PathBuf>,
    join_handle: Mutex<Option<JoinHandle<()>>>,
}

impl McpBridge {
    pub fn start(app_handle: AppHandle) -> Result<Arc<Self>> {
        let discovery_path = discovery_path(&app_handle)?;
        if let Some(parent) = discovery_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create MCP directory at {parent:?}"))?;
            set_private_directory_permissions(parent)?;
        }

        let (listener, endpoint, endpoint_path) = bind_local_listener()?;
        let token = Uuid::new_v4().simple().to_string();
        let discovery = DiscoveryFile {
            version: 1,
            transport: endpoint.transport.to_string(),
            endpoint: endpoint.value,
            token: token.clone(),
        };
        write_discovery_file(&discovery_path, &discovery)?;

        let runtime = Arc::new(BridgeRuntime {
            app_handle,
            token,
            stop: AtomicBool::new(false),
        });
        let runtime_for_thread = Arc::clone(&runtime);
        let join_handle = thread::Builder::new()
            .name("hajimi-mcp-bridge".to_string())
            .spawn(move || serve_listener(listener, runtime_for_thread))
            .context("failed to start MCP bridge thread")?;

        let bridge = Arc::new(Self {
            runtime,
            discovery_path,
            endpoint_path,
            join_handle: Mutex::new(Some(join_handle)),
        });
        Ok(bridge)
    }

    pub fn stop(&self) {
        if self.runtime.stop.swap(true, Ordering::Relaxed) {
            return;
        }

        let _ = fs::remove_file(&self.discovery_path);
        if let Some(endpoint_path) = &self.endpoint_path {
            let _ = fs::remove_file(endpoint_path);
        }

        if let Ok(mut guard) = self.join_handle.lock() {
            if let Some(handle) = guard.take() {
                let _ = handle.join();
            }
        }
    }
}

impl Drop for McpBridge {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn connection_info(app_handle: &AppHandle) -> McpConnectionInfo {
    let discovery_path = discovery_path(app_handle)
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();
    let executable_path = std::env::current_exe()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();
    let available = !discovery_path.is_empty() && Path::new(&discovery_path).is_file();

    McpConnectionInfo {
        available,
        discovery_path,
        executable_path,
    }
}

fn discovery_path(app_handle: &AppHandle) -> Result<PathBuf> {
    Ok(app_handle
        .path()
        .app_config_dir()?
        .join("mcp")
        .join("bridge.json"))
}

fn write_discovery_file(path: &Path, discovery: &DiscoveryFile) -> Result<()> {
    let temp_path = path.with_extension(format!("json.{}", Uuid::new_v4().simple()));
    let mut file = private_file(&temp_path)?;
    serde_json::to_writer_pretty(&mut file, discovery)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    drop(file);
    fs::rename(&temp_path, path)?;
    set_private_file_permissions(path)?;
    Ok(())
}

fn private_file(path: &Path) -> Result<File> {
    let mut options = OpenOptions::new();
    options.create_new(true).write(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

fn set_private_file_permissions(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn set_private_directory_permissions(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

struct Endpoint {
    transport: &'static str,
    value: String,
}

#[cfg(unix)]
type LocalListener = std::os::unix::net::UnixListener;
#[cfg(unix)]
type LocalStream = std::os::unix::net::UnixStream;

#[cfg(not(unix))]
type LocalListener = std::net::TcpListener;
#[cfg(not(unix))]
type LocalStream = std::net::TcpStream;

fn bind_local_listener() -> Result<(LocalListener, Endpoint, Option<PathBuf>)> {
    #[cfg(unix)]
    {
        use std::os::unix::net::UnixListener;
        let endpoint_path =
            std::env::temp_dir().join(format!("hajimi-mcp-{}.sock", Uuid::new_v4().simple()));
        let _ = fs::remove_file(&endpoint_path);
        let listener = UnixListener::bind(&endpoint_path)?;
        listener.set_nonblocking(true)?;
        return Ok((
            listener,
            Endpoint {
                transport: "unix",
                value: endpoint_path.to_string_lossy().into_owned(),
            },
            Some(endpoint_path),
        ));
    }

    #[cfg(not(unix))]
    {
        use std::net::TcpListener;
        let listener = TcpListener::bind(("127.0.0.1", 0))?;
        listener.set_nonblocking(true)?;
        let address = listener.local_addr()?.to_string();
        return Ok((
            listener,
            Endpoint {
                transport: "tcp",
                value: address,
            },
            None,
        ));
    }
}

trait LocalListenerAccept {
    fn accept_local(&self) -> io::Result<LocalStream>;
}

#[cfg(unix)]
impl LocalListenerAccept for LocalListener {
    fn accept_local(&self) -> io::Result<LocalStream> {
        self.accept().map(|(stream, _)| stream)
    }
}

#[cfg(not(unix))]
impl LocalListenerAccept for LocalListener {
    fn accept_local(&self) -> io::Result<LocalStream> {
        self.accept().map(|(stream, _)| stream)
    }
}

fn serve_listener(listener: LocalListener, runtime: Arc<BridgeRuntime>) {
    while !runtime.stop.load(Ordering::Relaxed) {
        match listener.accept_local() {
            Ok(stream) => {
                let runtime = Arc::clone(&runtime);
                let _ = thread::Builder::new()
                    .name("hajimi-mcp-client".to_string())
                    .spawn(move || handle_bridge_connection(stream, runtime));
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                if !runtime.stop.load(Ordering::Relaxed) {
                    eprintln!("hajimi MCP bridge stopped accepting connections: {error}");
                }
                break;
            }
        }
    }
}

fn handle_bridge_connection(stream: LocalStream, runtime: Arc<BridgeRuntime>) {
    let reader_stream = match stream.try_clone() {
        Ok(stream) => stream,
        Err(_) => return,
    };
    let mut reader = BufReader::new(reader_stream);
    let mut writer = BufWriter::new(stream);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => return,
            Ok(_) if line.len() > MAX_LINE_BYTES => {
                let response = BridgeResponse {
                    id: Value::Null,
                    ok: false,
                    result: None,
                    error: Some("request exceeds the 1 MiB limit".to_string()),
                };
                let _ = write_json_line(&mut writer, &response);
                return;
            }
            Ok(_) => {}
        }

        let response = match serde_json::from_str::<BridgeRequest>(line.trim_end()) {
            Ok(request) => dispatch_bridge_request(request, &runtime),
            Err(error) => BridgeResponse {
                id: Value::Null,
                ok: false,
                result: None,
                error: Some(format!("invalid request: {error}")),
            },
        };
        if write_json_line(&mut writer, &response).is_err() {
            return;
        }
    }
}

fn write_json_line(writer: &mut BufWriter<LocalStream>, value: &impl Serialize) -> io::Result<()> {
    serde_json::to_writer(&mut *writer, value).map_err(io::Error::other)?;
    writer.write_all(b"\n")?;
    writer.flush()
}

fn dispatch_bridge_request(request: BridgeRequest, runtime: &BridgeRuntime) -> BridgeResponse {
    if request.token != runtime.token {
        return BridgeResponse {
            id: request.id,
            ok: false,
            result: None,
            error: Some("unauthorized MCP bridge request".to_string()),
        };
    }

    let result = match request.method.as_str() {
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": tool_definitions() })),
        "tools/call" => call_tool(&runtime.app_handle, &request.params),
        method => Err(anyhow!("unsupported bridge method: {method}")),
    };

    match result {
        Ok(result) => BridgeResponse {
            id: request.id,
            ok: true,
            result: Some(result),
            error: None,
        },
        Err(error) => BridgeResponse {
            id: request.id,
            ok: false,
            result: None,
            error: Some(error.to_string()),
        },
    }
}

fn tool_definitions() -> Value {
    json!([
        {
            "name": "search_files",
            "description": "Search indexed files and folders in hajimi. The query supports hajimi keywords, filters, and wildcards.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "File or folder search query." },
                    "directoryQuery": { "type": "string", "description": "Optional folder scope query." },
                    "caseSensitive": { "type": "boolean", "default": false },
                    "limit": { "type": "integer", "minimum": 1, "maximum": MAX_RESULTS, "default": 100 }
                },
                "required": ["query"]
            }
        },
        {
            "name": "open_path",
            "description": "Open a file or folder with the operating system's default application.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        },
        {
            "name": "reveal_in_finder",
            "description": "Reveal a file or folder in Finder.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }
        }
    ])
}

fn call_tool(app_handle: &AppHandle, params: &Value) -> Result<Value> {
    let object = params
        .as_object()
        .ok_or_else(|| anyhow!("tools/call params must be an object"))?;
    let name = object
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("tools/call requires a tool name"))?;
    let arguments = object.get("arguments").unwrap_or(&Value::Null);

    let structured = match name {
        "search_files" => search_files(app_handle, arguments)?,
        "open_path" => open_path(arguments)?,
        "reveal_in_finder" => reveal_in_finder(arguments)?,
        _ => bail!("unknown MCP tool: {name}"),
    };
    let text = serde_json::to_string_pretty(&structured)?;
    Ok(json!({
        "content": [{ "type": "text", "text": text }],
        "structuredContent": structured,
        "isError": false
    }))
}

fn search_files(app_handle: &AppHandle, arguments: &Value) -> Result<Value> {
    let object = arguments
        .as_object()
        .ok_or_else(|| anyhow!("search_files arguments must be an object"))?;
    let query = object
        .get("query")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|query| !query.is_empty())
        .ok_or_else(|| anyhow!("search_files requires a non-empty query"))?;
    let directory_query = object
        .get("directoryQuery")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|query| !query.is_empty())
        .map(ToOwned::to_owned);
    let case_sensitive = object
        .get("caseSensitive")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let limit = object
        .get("limit")
        .and_then(Value::as_u64)
        .unwrap_or(100)
        .clamp(1, MAX_RESULTS as u64) as usize;

    let state = app_handle.state::<SearchState>();
    let response = state
        .search_sync(
            directory_query,
            Some(query.to_string()),
            SearchOptionsPayload {
                case_insensitive: !case_sensitive,
            },
        )
        .map_err(|error| anyhow!(error))?;
    let indices = response.results.iter().take(limit).copied().collect();
    let nodes = state.request_nodes_for_mcp(indices);
    let results = nodes
        .into_iter()
        .map(|node| {
            let metadata = node.metadata.as_ref();
            McpSearchFile {
                path: node.path.to_string_lossy().into_owned(),
                node_type: metadata.as_ref().map(|value| value.r#type() as u8),
                size: metadata.as_ref().map(|value| value.size()),
                created_at: metadata
                    .as_ref()
                    .and_then(|value| value.ctime().map(|time| time.get())),
                modified_at: metadata
                    .as_ref()
                    .and_then(|value| value.mtime().map(|time| time.get())),
            }
        })
        .collect::<Vec<_>>();

    Ok(json!({
        "query": query,
        "count": results.len(),
        "truncated": response.results.len() > limit,
        "highlights": response.highlights,
        "results": results
    }))
}

fn required_path(arguments: &Value) -> Result<&str> {
    arguments
        .as_object()
        .and_then(|object| object.get("path"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .ok_or_else(|| anyhow!("a non-empty path is required"))
}

fn open_path(arguments: &Value) -> Result<Value> {
    let path = required_path(arguments)?;
    open_path_impl(path)?;
    Ok(json!({ "path": path, "opened": true }))
}

fn reveal_in_finder(arguments: &Value) -> Result<Value> {
    let path = required_path(arguments)?;
    reveal_in_finder_impl(path)?;
    Ok(json!({ "path": path, "revealed": true }))
}

fn read_discovery(path: &Path) -> Result<DiscoveryFile> {
    let file = File::open(path)
        .with_context(|| format!("failed to open MCP discovery file at {path:?}"))?;
    let discovery: DiscoveryFile = serde_json::from_reader(file)?;
    if discovery.version != 1 {
        bail!("unsupported MCP discovery version: {}", discovery.version);
    }
    Ok(discovery)
}

fn connect_local(discovery: &DiscoveryFile) -> Result<LocalStream> {
    #[cfg(unix)]
    {
        if discovery.transport != "unix" {
            bail!(
                "unsupported local transport on this platform: {}",
                discovery.transport
            );
        }
        return Ok(std::os::unix::net::UnixStream::connect(
            &discovery.endpoint,
        )?);
    }

    #[cfg(not(unix))]
    {
        if discovery.transport != "tcp" {
            bail!(
                "unsupported local transport on this platform: {}",
                discovery.transport
            );
        }
        return Ok(std::net::TcpStream::connect(&discovery.endpoint)?);
    }
}

fn bridge_call(discovery: &DiscoveryFile, id: Value, method: &str, params: Value) -> Result<Value> {
    let mut stream = connect_local(discovery)?;
    let request = json!({
        "id": id,
        "token": discovery.token,
        "method": method,
        "params": params
    });
    serde_json::to_writer(&mut stream, &request)?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    if line.len() > MAX_LINE_BYTES {
        bail!("MCP bridge response exceeds the 1 MiB limit");
    }
    let response: BridgeResponse = serde_json::from_str(line.trim_end())?;
    if response.ok {
        response
            .result
            .ok_or_else(|| anyhow!("MCP bridge returned no result"))
    } else {
        bail!(
            response
                .error
                .unwrap_or_else(|| "MCP bridge request failed".to_string())
        )
    }
}

pub fn run_stdio(discovery_path: &Path) -> Result<()> {
    let discovery = read_discovery(discovery_path)?;
    let stdin = io::stdin();
    let mut reader = BufReader::new(stdin.lock());
    let stdout = io::stdout();
    let mut writer = BufWriter::new(stdout.lock());
    let mut line = String::new();

    loop {
        line.clear();
        let bytes = reader.read_line(&mut line)?;
        if bytes == 0 {
            return Ok(());
        }
        if line.len() > MAX_LINE_BYTES {
            write_stdio_error(
                &mut writer,
                Value::Null,
                -32600,
                "request exceeds the 1 MiB limit",
            )?;
            continue;
        }

        let request: Value = match serde_json::from_str(line.trim_end()) {
            Ok(request) => request,
            Err(error) => {
                write_stdio_error(
                    &mut writer,
                    Value::Null,
                    -32700,
                    &format!("parse error: {error}"),
                )?;
                continue;
            }
        };
        let method = request
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let id = request.get("id").cloned();

        if id.is_none() && method.starts_with("notifications/") {
            continue;
        }

        let Some(id) = id else {
            write_stdio_error(&mut writer, Value::Null, -32600, "request id is required")?;
            continue;
        };

        let result = match method {
            "initialize" => Ok(json!({
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": { "name": "hajimi", "version": env!("CARGO_PKG_VERSION") }
            })),
            "ping" => Ok(json!({})),
            "tools/list" | "tools/call" => bridge_call(
                &discovery,
                id.clone(),
                method,
                request.get("params").cloned().unwrap_or(Value::Null),
            ),
            _ => Err(anyhow!("method not found: {method}")),
        };

        match result {
            Ok(result) => write_stdio_result(&mut writer, id, result)?,
            Err(error) => write_stdio_error(&mut writer, id, -32603, &error.to_string())?,
        }
    }
}

fn write_stdio_result(
    writer: &mut BufWriter<impl Write>,
    id: Value,
    result: Value,
) -> io::Result<()> {
    serde_json::to_writer(
        &mut *writer,
        &json!({ "jsonrpc": "2.0", "id": id, "result": result }),
    )
    .map_err(io::Error::other)?;
    writer.write_all(b"\n")?;
    writer.flush()
}

fn write_stdio_error(
    writer: &mut BufWriter<impl Write>,
    id: Value,
    code: i32,
    message: &str,
) -> io::Result<()> {
    serde_json::to_writer(
        &mut *writer,
        &json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }),
    )
    .map_err(io::Error::other)?;
    writer.write_all(b"\n")?;
    writer.flush()
}
