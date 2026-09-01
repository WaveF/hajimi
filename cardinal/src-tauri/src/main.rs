// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--mcp") {
        let discovery_path = args
            .windows(2)
            .find(|pair| pair[0] == "--discovery")
            .map(|pair| std::path::PathBuf::from(&pair[1]))
            .or_else(|| std::env::var_os("HAJIMI_MCP_DISCOVERY").map(std::path::PathBuf::from));
        let Some(discovery_path) = discovery_path else {
            eprintln!("hajimi MCP adapter requires --discovery <path>");
            std::process::exit(2);
        };
        if let Err(error) = hajimi_lib::run_mcp(&discovery_path) {
            eprintln!("hajimi MCP adapter failed: {error:#}");
            std::process::exit(1);
        }
        return;
    }

    hajimi_lib::run().unwrap();
}
