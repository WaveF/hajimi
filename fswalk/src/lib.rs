use rayon::{iter::ParallelBridge, prelude::ParallelIterator};
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::{
    fs::{self, Metadata},
    io::{Error, ErrorKind},
    num::NonZeroU64,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, AtomicUsize, Ordering},
    time::UNIX_EPOCH,
};

#[derive(Serialize, Debug)]
pub struct Node {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Node>,
    pub name: Box<str>,
    pub metadata: Option<NodeMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct NodeMetadata {
    pub r#type: NodeFileType,
    pub size: u64,
    pub ctime: Option<NonZeroU64>,
    pub mtime: Option<NonZeroU64>,
}

impl From<Metadata> for NodeMetadata {
    fn from(metadata: Metadata) -> Self {
        Self::new(&metadata)
    }
}

impl NodeMetadata {
    fn new(metadata: &Metadata) -> Self {
        let r#type = metadata.file_type().into();
        let size = metadata.size();
        let ctime = metadata
            .created()
            .ok()
            .and_then(|x| x.duration_since(UNIX_EPOCH).ok())
            .and_then(|x| NonZeroU64::new(x.as_secs()));
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|x| x.duration_since(UNIX_EPOCH).ok())
            .and_then(|x| NonZeroU64::new(x.as_secs()));
        Self {
            r#type,
            size,
            ctime,
            mtime,
        }
    }
}

#[derive(Debug, Serialize_repr, Deserialize_repr, Clone, Copy, enumn::N, PartialEq, Eq)]
#[repr(u8)]
pub enum NodeFileType {
    // File occurs a lot, assign it to 0 for better compression ratio(I guess... maybe useful).
    File = 0,
    Dir = 1,
    Symlink = 2,
    Unknown = 3,
}

impl From<fs::FileType> for NodeFileType {
    fn from(file_type: fs::FileType) -> Self {
        if file_type.is_file() {
            NodeFileType::File
        } else if file_type.is_dir() {
            NodeFileType::Dir
        } else if file_type.is_symlink() {
            NodeFileType::Symlink
        } else {
            NodeFileType::Unknown
        }
    }
}

#[derive(Debug, Clone)]
enum PatternPart {
    DoubleStar,
    Segment(Vec<PatternToken>),
}

#[derive(Debug, Clone)]
enum PatternToken {
    Literal(char),
    AnyChar,
    AnyString,
    CharacterClass {
        negated: bool,
        ranges: Vec<(char, char)>,
    },
}

#[derive(Debug, Clone)]
struct IgnorePattern {
    parts: Vec<PatternPart>,
    /// A pattern without a slash matches a path component at any depth.
    any_component: bool,
    /// A leading slash makes a pattern relative to the filesystem root.
    absolute: bool,
    directory_only: bool,
}

impl IgnorePattern {
    fn parse(raw: &Path) -> Option<Self> {
        let mut value = raw.to_string_lossy().trim().to_string();
        if value.is_empty() || value.starts_with('#') || value.starts_with('!') {
            return None;
        }

        let directory_only = value.ends_with('/') && value != "/";
        if directory_only {
            value.pop();
        }

        let absolute = value.starts_with('/');
        if absolute {
            value.remove(0);
        }

        let any_component = !value.contains('/');
        let parts = if value.is_empty() {
            Vec::new()
        } else {
            value
                .split('/')
                .map(|part| {
                    if part == "**" {
                        PatternPart::DoubleStar
                    } else {
                        PatternPart::Segment(parse_segment(part))
                    }
                })
                .collect()
        };

        Some(Self {
            parts,
            any_component,
            absolute,
            directory_only,
        })
    }

    fn matching_depth(&self, components: &[String]) -> Option<usize> {
        if self.any_component {
            return components
                .iter()
                .enumerate()
                .rev()
                .find_map(|(index, component)| {
                    segment_matches(&self.parts, component).then_some(index + 1)
                });
        }

        let mut memo = vec![vec![None; components.len() + 1]; self.parts.len() + 1];
        self.matches_from(0, 0, components, &mut memo)
            .then_some(components.len())
    }

    fn matches_from(
        &self,
        pattern_index: usize,
        component_index: usize,
        components: &[String],
        memo: &mut [Vec<Option<bool>>],
    ) -> bool {
        if let Some(result) = memo[pattern_index][component_index] {
            return result;
        }

        let result = if pattern_index == self.parts.len() {
            component_index == components.len()
        } else {
            match &self.parts[pattern_index] {
                PatternPart::DoubleStar => {
                    self.matches_from(pattern_index + 1, component_index, components, memo)
                        || (component_index < components.len()
                            && self.matches_from(
                                pattern_index,
                                component_index + 1,
                                components,
                                memo,
                            ))
                }
                PatternPart::Segment(tokens) => {
                    component_index < components.len()
                        && segment_tokens_match(tokens, &components[component_index])
                        && self.matches_from(
                            pattern_index + 1,
                            component_index + 1,
                            components,
                            memo,
                        )
                }
            }
        };

        memo[pattern_index][component_index] = Some(result);
        result
    }
}

fn parse_segment(segment: &str) -> Vec<PatternToken> {
    let chars: Vec<_> = segment.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < chars.len() {
        match chars[index] {
            '*' => {
                if !matches!(tokens.last(), Some(PatternToken::AnyString)) {
                    tokens.push(PatternToken::AnyString);
                }
            }
            '?' => tokens.push(PatternToken::AnyChar),
            '[' => {
                let mut cursor = index + 1;
                let negated = chars.get(cursor).is_some_and(|c| *c == '!' || *c == '^');
                if negated {
                    cursor += 1;
                }
                let class_start = cursor;
                while cursor < chars.len() && chars[cursor] != ']' {
                    cursor += 1;
                }
                if cursor == chars.len() || cursor == class_start {
                    tokens.push(PatternToken::Literal('['));
                } else {
                    let class_chars = &chars[class_start..cursor];
                    let mut ranges = Vec::new();
                    let mut class_index = 0;
                    while class_index < class_chars.len() {
                        if class_index + 2 < class_chars.len()
                            && class_chars[class_index + 1] == '-'
                        {
                            ranges.push((class_chars[class_index], class_chars[class_index + 2]));
                            class_index += 3;
                        } else {
                            ranges.push((class_chars[class_index], class_chars[class_index]));
                            class_index += 1;
                        }
                    }
                    tokens.push(PatternToken::CharacterClass { negated, ranges });
                    index = cursor;
                }
            }
            character => tokens.push(PatternToken::Literal(character)),
        }
        index += 1;
    }

    tokens
}

fn segment_matches(parts: &[PatternPart], component: &str) -> bool {
    match parts {
        [PatternPart::Segment(tokens)] => segment_tokens_match(tokens, component),
        _ => false,
    }
}

fn segment_tokens_match(tokens: &[PatternToken], component: &str) -> bool {
    let chars: Vec<_> = component.chars().collect();
    let mut memo = vec![vec![None; chars.len() + 1]; tokens.len() + 1];

    fn matches_from(
        token_index: usize,
        char_index: usize,
        tokens: &[PatternToken],
        chars: &[char],
        memo: &mut [Vec<Option<bool>>],
    ) -> bool {
        if let Some(result) = memo[token_index][char_index] {
            return result;
        }

        let result = if token_index == tokens.len() {
            char_index == chars.len()
        } else {
            match &tokens[token_index] {
                PatternToken::AnyString => {
                    matches_from(token_index + 1, char_index, tokens, chars, memo)
                        || (char_index < chars.len()
                            && matches_from(token_index, char_index + 1, tokens, chars, memo))
                }
                PatternToken::AnyChar => {
                    char_index < chars.len()
                        && matches_from(token_index + 1, char_index + 1, tokens, chars, memo)
                }
                PatternToken::Literal(expected) => {
                    char_index < chars.len()
                        && *expected == chars[char_index]
                        && matches_from(token_index + 1, char_index + 1, tokens, chars, memo)
                }
                PatternToken::CharacterClass { negated, ranges } => {
                    if char_index >= chars.len() {
                        false
                    } else {
                        let matched = ranges.iter().any(|(start, end)| {
                            *start <= chars[char_index] && chars[char_index] <= *end
                        });
                        *negated != matched
                            && matches_from(token_index + 1, char_index + 1, tokens, chars, memo)
                    }
                }
            }
        };

        memo[token_index][char_index] = Some(result);
        result
    }

    matches_from(0, 0, tokens, &chars, &mut memo)
}

fn path_components(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|component| match component {
            std::path::Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect()
}

/// Compiled ignore/include rules shared by filesystem walking and event filtering.
///
/// Ignore rules use a gitignore-inspired syntax. Include paths intentionally remain
/// concrete paths because they are the explicit exception mechanism exposed by the UI.
#[derive(Debug, Clone)]
pub struct PathFilter {
    root_path: PathBuf,
    ignore_patterns: Vec<IgnorePattern>,
    include_paths: Vec<PathBuf>,
}

impl PathFilter {
    pub fn new(root_path: &Path, ignore_paths: &[PathBuf], include_paths: &[PathBuf]) -> Self {
        Self {
            root_path: root_path.to_path_buf(),
            ignore_patterns: ignore_paths
                .iter()
                .filter_map(|path| IgnorePattern::parse(path))
                .collect(),
            include_paths: include_paths.to_vec(),
        }
    }

    pub fn should_ignore(&self, path: &Path) -> bool {
        self.should_ignore_with_type(path, None)
    }

    pub fn should_ignore_with_type(&self, path: &Path, is_dir: Option<bool>) -> bool {
        if self.ignore_patterns.is_empty() && self.include_paths.is_empty() {
            return false;
        }

        // Keep ancestors of an explicit include path traversable so the walker can reach it.
        if self
            .include_paths
            .iter()
            .any(|include| include.starts_with(path) && include != path)
        {
            return false;
        }

        let relative_components = path.strip_prefix(&self.root_path).ok().map(path_components);
        let absolute_components = path_components(path);

        let ignore_depth = self
            .ignore_patterns
            .iter()
            .filter_map(|pattern| {
                let components = if pattern.absolute {
                    &absolute_components
                } else {
                    relative_components.as_ref()?
                };

                (0..=components.len()).rev().find_map(|depth| {
                    let matched_depth = pattern.matching_depth(&components[..depth])?;
                    if pattern.directory_only
                        && matched_depth == components.len()
                        && is_dir == Some(false)
                    {
                        return None;
                    }
                    Some(matched_depth)
                })
            })
            .max();

        let include_depth = self
            .include_paths
            .iter()
            .filter(|include| path.starts_with(include))
            .map(|include| path_components(include).len())
            .max();

        match (ignore_depth, include_depth) {
            (None, _) => false,
            (Some(_), None) => true,
            (Some(ignore_depth), Some(include_depth)) => ignore_depth > include_depth,
        }
    }
}

/// `path` is ignored under longest-prefix-match: among the entries in
/// `ignore_directories` and `include_paths` that contain `path`, whichever
/// sits deeper wins. Ties keep the path. This lets nested overrides compose
/// (e.g. ignore `/a`, include `/a/b`, re-ignore `/a/b/c`).
///
/// One traversal-specific exception: if `path` is a strict ancestor of any
/// include entry, it is kept regardless of ignores so the walker can recurse
/// down to reach the include subtree.
pub fn should_ignore_path(
    path: &Path,
    ignore_directories: &[PathBuf],
    include_paths: &[PathBuf],
) -> bool {
    should_ignore_path_from_root(path, Path::new("/"), ignore_directories, include_paths)
}

pub fn should_ignore_path_from_root(
    path: &Path,
    root_path: &Path,
    ignore_paths: &[PathBuf],
    include_paths: &[PathBuf],
) -> bool {
    PathFilter::new(root_path, ignore_paths, include_paths).should_ignore(path)
}

pub struct WalkData<'w, F: Fn() -> bool> {
    pub num_files: AtomicUsize,
    pub num_dirs: AtomicUsize,
    /// Cancellation will be checked periodically.
    cancel: F,
    pub root_path: &'w Path,
    pub ignore_directories: &'w [PathBuf],
    /// Paths to include even when they fall under an ignored directory.
    pub include_paths: &'w [PathBuf],
    path_filter: PathFilter,
    /// If set, metadata will be collected for each file node(folder node will get free metadata).
    need_metadata: bool,
}

impl<F> std::fmt::Debug for WalkData<'_, F>
where
    F: Fn() -> bool,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WalkData")
            .field("num_files", &self.num_files.load(Ordering::Relaxed))
            .field("num_dirs", &self.num_dirs.load(Ordering::Relaxed))
            .field("cancel", &((self.cancel)()))
            .field("root_path", &self.root_path)
            .field("ignore_directories", &self.ignore_directories)
            .field("include_paths", &self.include_paths)
            .field("need_metadata", &self.need_metadata)
            .finish()
    }
}

impl<'w> WalkData<'w, fn() -> bool> {
    pub fn simple(root_path: &'w Path, need_metadata: bool) -> Self {
        fn never_cancel() -> bool {
            false
        }

        Self {
            num_files: AtomicUsize::new(0),
            num_dirs: AtomicUsize::new(0),
            cancel: never_cancel,
            root_path,
            ignore_directories: &[],
            include_paths: &[],
            path_filter: PathFilter::new(root_path, &[], &[]),
            need_metadata,
        }
    }
}

impl<'w, F: Fn() -> bool> WalkData<'w, F> {
    pub fn new(
        root_path: &'w Path,
        ignore_directories: &'w [PathBuf],
        include_paths: &'w [PathBuf],
        need_metadata: bool,
        cancel: F,
    ) -> Self {
        Self {
            num_files: AtomicUsize::new(0),
            num_dirs: AtomicUsize::new(0),
            cancel,
            root_path,
            ignore_directories,
            include_paths,
            path_filter: PathFilter::new(root_path, ignore_directories, include_paths),
            need_metadata,
        }
    }

    fn should_ignore_with_type(&self, path: &Path, is_dir: bool) -> bool {
        self.path_filter.should_ignore_with_type(path, Some(is_dir))
    }

    #[cfg(test)]
    fn should_ignore(&self, path: &Path) -> bool {
        self.path_filter.should_ignore(path)
    }

    fn is_cancelled(&self) -> bool {
        (self.cancel)()
    }
}

/// return `Some(Node)` if walk is successful.
/// return `None` if walk is cancelled.
///
/// Note: if the root path is missing or inaccessible, it will still return
/// `Some(Node)` with empty children and None metadata.
pub fn walk_it_without_root_chain<F: Fn() -> bool + Send + Sync>(
    walk_data: &WalkData<'_, F>,
) -> Option<Node> {
    walk(walk_data.root_path, walk_data)
}

/// return `Some(Node)` if walk is successful.
/// return `None` if walk is cancelled.
///
/// Note: if the root path is missing or inaccessible, it will still return
/// `Some(Node)` with empty children and None metadata.
pub fn walk_it<F: Fn() -> bool + Send + Sync>(walk_data: &WalkData<'_, F>) -> Option<Node> {
    walk(walk_data.root_path, walk_data).map(|node_tree| {
        if let Some(parent) = walk_data.root_path.parent() {
            let mut path = PathBuf::from(parent);
            let mut node = Node {
                children: vec![node_tree],
                name: path
                    .iter()
                    .next_back()
                    .expect("at least one parent segment in root path")
                    .to_string_lossy()
                    .into_owned()
                    .into_boxed_str(),
                metadata: metadata_of_path(&path).map(NodeMetadata::from),
            };
            while path.pop() {
                node = Node {
                    children: vec![node],
                    name: path
                        .iter()
                        .next_back()
                        .expect("at least one parent segment in root path")
                        .to_string_lossy()
                        .into_owned()
                        .into_boxed_str(),
                    metadata: metadata_of_path(&path).map(NodeMetadata::from),
                };
            }
            node
        } else {
            node_tree
        }
    })
}

/// Note: this function will create a Node for the given path even if it's
/// missing or inaccessible, but the metadata will be None in that case.
fn walk<F: Fn() -> bool + Send + Sync>(path: &Path, walk_data: &WalkData<'_, F>) -> Option<Node> {
    let metadata = metadata_of_path(path);
    let children = if metadata.as_ref().map(|x| x.is_dir()).unwrap_or_default() {
        walk_data.num_dirs.fetch_add(1, Ordering::Relaxed);
        let read_dir = fs::read_dir(path);
        match read_dir {
            Ok(entries) => {
                let cancelled = AtomicBool::new(false);
                let results: Vec<_> = entries
                    .into_iter()
                    .par_bridge()
                    .map(|entry| {
                        match &entry {
                            Ok(entry) => {
                                if walk_data.is_cancelled() {
                                    cancelled.store(true, Ordering::Relaxed);
                                    return None;
                                }
                                let path = entry.path();
                                let file_type = entry.file_type().ok()?;
                                if walk_data.should_ignore_with_type(&path, file_type.is_dir()) {
                                    return None;
                                }
                                // doesn't traverse symlink
                                if file_type.is_dir() {
                                    walk(&path, walk_data)
                                } else {
                                    walk_data.num_files.fetch_add(1, Ordering::Relaxed);
                                    let name = entry
                                        .file_name()
                                        .to_string_lossy()
                                        .into_owned()
                                        .into_boxed_str();
                                    Some(Node {
                                        children: vec![],
                                        name,
                                        metadata: walk_data
                                            .need_metadata
                                            .then_some(entry)
                                            .and_then(|entry| {
                                                // doesn't traverse symlink
                                                entry.metadata().ok().map(NodeMetadata::from)
                                            }),
                                    })
                                }
                            }
                            Err(_) => None,
                        }
                    })
                    .collect();
                if cancelled.load(Ordering::Acquire) {
                    return None;
                }
                results.into_iter().flatten().collect()
            }
            Err(_) => Vec::new(),
        }
    } else {
        walk_data.num_files.fetch_add(1, Ordering::Relaxed);
        Vec::new()
    };
    if walk_data.is_cancelled() {
        return None;
    }
    let name = path
        .file_name()
        .map(|x| x.to_string_lossy().into_owned().into_boxed_str())
        .unwrap_or_default();
    let mut children = children;
    children.sort_unstable_by(|a, b| a.name.cmp(&b.name));
    Some(Node {
        children,
        name,
        metadata: metadata.map(NodeMetadata::from),
    })
}

fn handle_error_and_retry(failed: &Error) -> bool {
    failed.kind() == std::io::ErrorKind::Interrupted
}

fn metadata_of_path(path: &Path) -> Option<Metadata> {
    // doesn't traverse symlink
    match path.symlink_metadata() {
        Ok(metadata) => Some(metadata),
        // If it's not found, we definitely don't want it.
        Err(e) if e.kind() == ErrorKind::NotFound => None,
        // If it's permission denied or something, we still want to insert it into the tree.
        Err(e) => {
            if handle_error_and_retry(&e) {
                // doesn't traverse symlink
                path.symlink_metadata().ok()
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        io::Write,
        path::{Component, Path, PathBuf},
        sync::atomic::AtomicBool,
        time::{Duration, Instant},
    };
    use tempdir::TempDir;

    fn node_for_path<'a>(node: &'a Node, path: &Path) -> &'a Node {
        let mut current = node;
        for component in path.components() {
            match component {
                Component::RootDir => {
                    assert_eq!(&*current.name, "/");
                }
                Component::Normal(name) => {
                    let name = name.to_string_lossy();
                    current = current
                        .children
                        .iter()
                        .find(|child| *child.name == name)
                        .unwrap_or_else(|| panic!("missing path segment: {name}"));
                }
                _ => {}
            }
        }
        current
    }

    #[test]
    fn test_walk_simple_tree_without_metadata() {
        let tmp = TempDir::new("fswalk_simple").unwrap();
        let root = tmp.path();
        fs::create_dir(root.join("dir_a")).unwrap();
        fs::File::create(root.join("file_a.txt")).unwrap();
        fs::File::create(root.join("dir_a/file_b.log")).unwrap();
        let walk_data = WalkData::simple(root, false);
        let node = walk_it(&walk_data).unwrap();
        let root_node = node_for_path(&node, root);
        assert_eq!(
            &*root_node.name,
            root.file_name().unwrap().to_str().unwrap()
        );
        // Root + dir + 2 files
        let mut counts = (0, 0);
        fn traverse(n: &Node, counts: &mut (usize, usize)) {
            if n.children.is_empty() {
                counts.0 += 1;
            } else {
                counts.1 += 1;
            }
            for c in &n.children {
                traverse(c, counts);
            }
        }
        traverse(root_node, &mut counts);
        assert_eq!(counts.0 + counts.1, 4);
        // Metadata for files should be None (walk_data.need_metadata = false)
        fn assert_no_file_metadata(n: &Node) {
            if n.children.is_empty() {
                assert!(
                    n.metadata.is_none(),
                    "file node metadata should be None when not requested: {:?}",
                    n.name
                );
            } else {
                // directory metadata may be Some (free metadata) but it's optional; ensure type correctness when present
                if let Some(m) = n.metadata {
                    assert!(matches!(m.r#type, NodeFileType::Dir));
                }
                for c in &n.children {
                    assert_no_file_metadata(c);
                }
            }
        }
        assert_no_file_metadata(root_node);
    }

    #[test]
    fn test_walk_sorts_children_and_preserves_global_order() {
        let tmp = TempDir::new("fswalk_sorted_children").unwrap();
        let root = tmp.path();
        fs::create_dir(root.join("dir_beta")).unwrap();
        fs::create_dir(root.join("dir_alpha")).unwrap();
        fs::File::create(root.join("file_delta.txt")).unwrap();
        fs::File::create(root.join("file_alpha.txt")).unwrap();
        fs::File::create(root.join("file_gamma.txt")).unwrap();

        let walk_data = WalkData::simple(root, false);
        let node = walk_it(&walk_data).expect("walked tree");
        let root_node = node_for_path(&node, root);

        let observed: Vec<&str> = root_node
            .children
            .iter()
            .map(|child| &*child.name)
            .collect();
        let expected = vec![
            "dir_alpha",
            "dir_beta",
            "file_alpha.txt",
            "file_delta.txt",
            "file_gamma.txt",
        ];
        assert_eq!(observed, expected);

        fn collect_paths(node: &Node, prefix: &Path, acc: &mut Vec<PathBuf>) {
            let current = if prefix.as_os_str().is_empty() {
                PathBuf::from(&*node.name)
            } else {
                prefix.join(&*node.name)
            };
            acc.push(current.clone());
            for child in &node.children {
                collect_paths(child, &current, acc);
            }
        }

        let mut preorder = Vec::new();
        collect_paths(root_node, Path::new(""), &mut preorder);
        let mut sorted = preorder.clone();
        sorted.sort();
        assert_eq!(
            preorder, sorted,
            "preorder traversal should match lexicographic path order"
        );
    }

    #[test]
    fn test_walk_with_metadata_enabled() {
        let tmp = TempDir::new("fswalk_meta").unwrap();
        let root = tmp.path();
        fs::File::create(root.join("meta_file.txt")).unwrap();
        let walk_data = WalkData::simple(root, true);
        let node = walk_it(&walk_data).unwrap();
        let root_node = node_for_path(&node, root);
        fn find<'a>(node: &'a Node, name: &str) -> Option<&'a Node> {
            if &*node.name == name {
                return Some(node);
            }
            for c in &node.children {
                if let Some(n) = find(c, name) {
                    return Some(n);
                }
            }
            None
        }
        let file_node = find(root_node, "meta_file.txt").unwrap();
        assert!(matches!(
            file_node.metadata.map(|m| m.r#type),
            Some(NodeFileType::File)
        ));
    }

    #[test]
    fn test_symlink_not_traversed() {
        let tmp = TempDir::new("fswalk_symlink").unwrap();
        let root = tmp.path();
        fs::create_dir(root.join("real_dir")).unwrap();
        fs::File::create(root.join("real_dir/file.txt")).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(root.join("real_dir"), root.join("link_dir")).unwrap();
        let walk_data = WalkData::simple(root, true);
        let node = walk_it(&walk_data).unwrap();
        let root_node = node_for_path(&node, root);
        // Ensure link_dir exists as a file system entry but not traversed (should be a file node with no children)
        fn get_child<'a>(n: &'a Node, name: &str) -> Option<&'a Node> {
            n.children.iter().find(|c| &*c.name == name)
        }
        let link = get_child(root_node, "link_dir").unwrap();
        assert!(
            link.children.is_empty(),
            "symlink directory should not be traversed"
        );
    }

    // ── should_ignore tests (gitignore-style matching) ────────────────────

    #[test]
    fn should_ignore_exact_match() {
        let ignore = vec![PathBuf::from("/a/b/c")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(wd.should_ignore(Path::new("/a/b/c")));
    }

    #[test]
    fn should_ignore_child_of_ignored_dir() {
        let ignore = vec![PathBuf::from("/a/b")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        // direct child
        assert!(wd.should_ignore(Path::new("/a/b/c")));
        // deeply nested
        assert!(wd.should_ignore(Path::new("/a/b/c/d/e")));
    }

    #[test]
    fn should_ignore_does_not_match_sibling_with_shared_prefix_string() {
        // "/tmp/abc" is NOT a child of "/tmp/ab" — Path::starts_with is
        // component-aware, not string-prefix.
        let ignore = vec![PathBuf::from("/tmp/ab")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(!wd.should_ignore(Path::new("/tmp/abc")));
        assert!(!wd.should_ignore(Path::new("/tmp/abc/d")));
    }

    #[test]
    fn should_ignore_unrelated_path() {
        let ignore = vec![PathBuf::from("/a/b")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(!wd.should_ignore(Path::new("/x/y")));
        assert!(!wd.should_ignore(Path::new("/a")));
    }

    #[test]
    fn should_ignore_empty_ignore_list() {
        let ignore: Vec<PathBuf> = vec![];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(!wd.should_ignore(Path::new("/anything")));
    }

    #[test]
    fn should_ignore_multiple_ignore_dirs() {
        let ignore = vec![PathBuf::from("/a"), PathBuf::from("/x/y")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(wd.should_ignore(Path::new("/a")));
        assert!(wd.should_ignore(Path::new("/a/b/c")));
        assert!(wd.should_ignore(Path::new("/x/y")));
        assert!(wd.should_ignore(Path::new("/x/y/z")));
        assert!(!wd.should_ignore(Path::new("/x")));
        assert!(!wd.should_ignore(Path::new("/b")));
    }

    #[test]
    fn relative_directory_pattern_matches_at_any_depth() {
        let ignore = vec![PathBuf::from("node_modules/")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], false, || false);

        assert!(wd.should_ignore(Path::new("/root/node_modules")));
        assert!(wd.should_ignore(Path::new("/root/project/node_modules")));
        assert!(wd.should_ignore(Path::new("/root/project/node_modules/package.json")));
        assert!(!wd.should_ignore(Path::new("/root/project/node_modules_backup")));
    }

    #[test]
    fn wildcard_pattern_matches_components_without_crossing_directories() {
        let ignore = vec![PathBuf::from("build/*/")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], false, || false);

        assert!(wd.should_ignore(Path::new("/root/build/debug")));
        assert!(wd.should_ignore(Path::new("/root/build/debug/output.o")));
        assert!(wd.should_ignore(Path::new("/root/build/debug/nested")));
        assert!(!wd.should_ignore(Path::new("/root/other/build/debug")));
    }

    #[test]
    fn doublestar_pattern_matches_any_number_of_directories() {
        let ignore = vec![PathBuf::from("**/vendor/")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], false, || false);

        assert!(wd.should_ignore(Path::new("/root/vendor")));
        assert!(wd.should_ignore(Path::new("/root/a/vendor")));
        assert!(wd.should_ignore(Path::new("/root/a/b/vendor/file")));
        assert!(!wd.should_ignore(Path::new("/root/a/vendorized")));
    }

    #[test]
    fn character_class_pattern_matches_expected_names() {
        let ignore = vec![PathBuf::from("cache[0-9]/")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], false, || false);

        assert!(wd.should_ignore(Path::new("/root/cache1")));
        assert!(!wd.should_ignore(Path::new("/root/cachex")));
    }

    #[test]
    fn comments_and_blank_rules_are_ignored() {
        let ignore = vec![PathBuf::from("# node dependencies"), PathBuf::from(" ")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], false, || false);

        assert!(!wd.should_ignore(Path::new("/root/node_modules")));
    }

    #[test]
    fn explicit_include_still_rescues_a_relative_ignore_pattern() {
        let ignore = vec![PathBuf::from("node_modules/")];
        let include = vec![PathBuf::from("/root/project/node_modules/keep")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &include, false, || false);

        assert!(!wd.should_ignore(Path::new("/root/project")));
        assert!(!wd.should_ignore(Path::new("/root/project/node_modules")));
        assert!(!wd.should_ignore(Path::new("/root/project/node_modules/keep")));
        assert!(!wd.should_ignore(Path::new("/root/project/node_modules/keep/file")));
    }

    #[test]
    fn should_ignore_parent_of_ignored_dir_is_not_ignored() {
        let ignore = vec![PathBuf::from("/a/b/c")];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || false);
        assert!(!wd.should_ignore(Path::new("/a")));
        assert!(!wd.should_ignore(Path::new("/a/b")));
    }

    // ── include_paths (exception) tests ──────────────────────────────────

    #[test]
    fn include_path_carves_out_subtree_from_ignored_dir() {
        let ignore = vec![PathBuf::from("/a")];
        let include = vec![PathBuf::from("/a/b")];
        let wd = WalkData::new(Path::new("/"), &ignore, &include, false, || false);
        // ancestor must be traversable to reach the include
        assert!(!wd.should_ignore(Path::new("/a")));
        // included subtree
        assert!(!wd.should_ignore(Path::new("/a/b")));
        assert!(!wd.should_ignore(Path::new("/a/b/c")));
        assert!(!wd.should_ignore(Path::new("/a/b/c/d")));
        // siblings of the include remain ignored
        assert!(wd.should_ignore(Path::new("/a/x")));
        assert!(wd.should_ignore(Path::new("/a/x/y")));
    }

    #[test]
    fn include_path_does_not_rescue_unrelated_ignored_dirs() {
        let ignore = vec![PathBuf::from("/a"), PathBuf::from("/z")];
        let include = vec![PathBuf::from("/a/b")];
        let wd = WalkData::new(Path::new("/"), &ignore, &include, false, || false);
        // /z has no overlapping include, so it stays ignored
        assert!(wd.should_ignore(Path::new("/z")));
        assert!(wd.should_ignore(Path::new("/z/q")));
    }

    #[test]
    fn multiple_include_paths_under_same_ignored_dir() {
        let ignore = vec![PathBuf::from("/a")];
        let include = vec![PathBuf::from("/a/b"), PathBuf::from("/a/c")];
        let wd = WalkData::new(Path::new("/"), &ignore, &include, false, || false);
        assert!(!wd.should_ignore(Path::new("/a")));
        assert!(!wd.should_ignore(Path::new("/a/b")));
        assert!(!wd.should_ignore(Path::new("/a/c")));
        assert!(wd.should_ignore(Path::new("/a/d")));
    }

    #[test]
    fn deeper_ignore_re_ignores_subtree_of_an_include() {
        // ignore /a, then include /a/b, then re-ignore /a/b/c.
        // longest-prefix wins: /a/b/c (depth 4) > /a/b (depth 3) > /a (depth 2).
        let ignore = vec![PathBuf::from("/a"), PathBuf::from("/a/b/c")];
        let include = vec![PathBuf::from("/a/b")];
        let wd = WalkData::new(Path::new("/"), &ignore, &include, false, || false);

        // ancestor of the include is still walkable
        assert!(!wd.should_ignore(Path::new("/a")));

        // include subtree is kept (depth 3 beats /a's depth 2)
        assert!(!wd.should_ignore(Path::new("/a/b")));
        assert!(!wd.should_ignore(Path::new("/a/b/file.txt")));

        // the re-ignore (depth 4) beats the include (depth 3)
        assert!(wd.should_ignore(Path::new("/a/b/c")));
        assert!(wd.should_ignore(Path::new("/a/b/c/sub")));
        assert!(wd.should_ignore(Path::new("/a/b/c/sub/file.txt")));

        // sibling outside both override layers is still ignored by /a
        assert!(wd.should_ignore(Path::new("/a/x")));
    }

    // ── other unit tests ─────────────────────────────────────────────────

    #[test]
    fn walk_data_debug_shows_cancel_state() {
        let ignore = vec![PathBuf::from("/a")];
        let wd = WalkData::new(Path::new("/root"), &ignore, &[], true, || false);
        let dbg = format!("{wd:?}");
        assert!(
            dbg.contains("cancel: false"),
            "Debug output should show cancel closure result: {dbg}"
        );
        assert!(
            dbg.contains("root_path"),
            "Debug output should include root_path: {dbg}"
        );
        assert!(
            dbg.contains("need_metadata: true"),
            "Debug output should include need_metadata: {dbg}"
        );

        let wd_cancelled = WalkData::new(Path::new("/root"), &ignore, &[], false, || true);
        let dbg2 = format!("{wd_cancelled:?}");
        assert!(
            dbg2.contains("cancel: true"),
            "Debug output should reflect cancel=true: {dbg2}"
        );
    }

    #[test]
    fn walk_data_closure_cancellation_is_dynamic() {
        let flag = AtomicBool::new(false);
        let ignore: Vec<PathBuf> = vec![];
        let wd = WalkData::new(Path::new("/"), &ignore, &[], false, || {
            flag.load(Ordering::Relaxed)
        });
        assert!(
            !wd.is_cancelled(),
            "should not be cancelled when flag is false"
        );

        flag.store(true, Ordering::Relaxed);
        assert!(
            wd.is_cancelled(),
            "should be cancelled after flag flipped to true"
        );

        flag.store(false, Ordering::Relaxed);
        assert!(
            !wd.is_cancelled(),
            "should reflect dynamic state of the closure"
        );
    }

    #[test]
    fn walk_data_simple_never_cancels() {
        let wd = WalkData::simple(Path::new("/tmp"), false);
        assert!(
            !wd.is_cancelled(),
            "simple WalkData should never report cancelled"
        );
    }

    #[test]
    fn test_handle_error_and_retry_only_interrupted() {
        let interrupted = Error::from(ErrorKind::Interrupted);
        assert!(handle_error_and_retry(&interrupted));
        let not_found = Error::from(ErrorKind::NotFound);
        assert!(!handle_error_and_retry(&not_found));
    }

    #[test]
    fn test_large_number_of_files_counts() {
        let tmp = TempDir::new("fswalk_many").unwrap();
        let root = tmp.path();
        for i in 0..50u32 {
            let mut f = fs::File::create(root.join(format!("f{i}.txt"))).unwrap();
            writeln!(f, "hello {i}").unwrap();
        }
        let walk_data = WalkData::simple(root, false);
        let node = walk_it(&walk_data).unwrap();
        let root_node = node_for_path(&node, root);
        // Expect 1 (root) + 50 file children
        assert_eq!(
            root_node.children.len(),
            50,
            "expected 50 files directly under root"
        );
    }

    #[test]
    fn regression_missing_root_path_currently_returns_some_node() {
        let tmp = TempDir::new("fswalk_missing_root").unwrap();
        let root = tmp.path().to_path_buf();
        drop(tmp);

        let ignore: Vec<PathBuf> = vec![];
        let walk_data = WalkData::new(&root, &ignore, &[], false, || false);
        let node = match walk_it_without_root_chain(&walk_data) {
            Some(node) => node,
            None => panic!("current behavior regression: expected Some, got None"),
        };

        assert!(
            node.children.is_empty(),
            "missing root currently produces a leaf node"
        );
        assert!(
            node.metadata.is_none(),
            "missing root currently has no metadata"
        );
        assert_eq!(
            walk_data.num_files.load(Ordering::Relaxed),
            1,
            "missing root currently increments file counter"
        );
    }

    #[test]
    fn missing_root_via_walk_it_returns_some_with_none_metadata() {
        let tmp = TempDir::new("fswalk_missing_walk_it").unwrap();
        let root = tmp.path().to_path_buf();
        drop(tmp); // remove the directory

        let ignore: Vec<PathBuf> = vec![];
        let walk_data = WalkData::new(&root, &ignore, &[], true, || false);
        let node = walk_it(&walk_data).expect("walk_it should return Some even for missing root");

        // Navigate to the leaf that represents the (now-missing) root.
        let root_node = node_for_path(&node, &root);
        assert!(
            root_node.children.is_empty(),
            "missing root should have no children"
        );
        assert!(
            root_node.metadata.is_none(),
            "missing root should have None metadata even when need_metadata is true"
        );
    }

    #[test]
    fn missing_root_metadata_is_none_regardless_of_need_metadata_flag() {
        let tmp = TempDir::new("fswalk_missing_meta_flag").unwrap();
        let root = tmp.path().to_path_buf();
        drop(tmp);

        for need_metadata in [false, true] {
            let ignore: Vec<PathBuf> = vec![];
            let walk_data = WalkData::new(&root, &ignore, &[], need_metadata, || false);
            let node = walk_it_without_root_chain(&walk_data)
                .expect("walk should return Some for missing path");
            assert!(
                node.metadata.is_none(),
                "missing path metadata should be None (need_metadata={need_metadata})"
            );
            assert!(
                node.children.is_empty(),
                "missing path should have no children (need_metadata={need_metadata})"
            );
        }
    }

    #[test]
    fn missing_root_name_is_preserved() {
        let tmp = TempDir::new("fswalk_missing_name").unwrap();
        let root = tmp.path().to_path_buf();
        let expected_name = root.file_name().unwrap().to_string_lossy().into_owned();
        drop(tmp);

        let ignore: Vec<PathBuf> = vec![];
        let walk_data = WalkData::new(&root, &ignore, &[], false, || false);
        let node = walk_it_without_root_chain(&walk_data)
            .expect("walk should return Some for missing path");
        assert_eq!(
            &*node.name, expected_name,
            "missing root node should preserve the directory name"
        );
    }

    #[test]
    #[ignore]
    fn test_search_root() {
        let done = AtomicBool::new(false);
        let path = [PathBuf::from("/System/Volumes/Data")];
        let walk_data = WalkData::new(Path::new("/"), &path, &[], false, || false);
        std::thread::scope(|s| {
            s.spawn(|| {
                let node = walk_it(&walk_data).unwrap();
                println!("root has {} children", node.children.len());
                done.store(true, Ordering::Relaxed);
            });
            s.spawn(|| {
                while !done.load(Ordering::Relaxed) {
                    let files = walk_data.num_files.load(Ordering::Relaxed);
                    let dirs = walk_data.num_dirs.load(Ordering::Relaxed);
                    println!("so far: {files} files, {dirs} dirs");
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }
            });
        });
    }

    #[test]
    #[ignore]
    fn test_search_simulator() {
        let done = AtomicBool::new(false);
        let ignore = vec![PathBuf::from("/System/Volumes/Data")];
        let walk_data = WalkData::new(
            Path::new("/Library/Developer/CoreSimulator/Volumes/iOS_23A343"),
            &ignore,
            &[],
            true,
            || false,
        );
        std::thread::scope(|s| {
            s.spawn(|| {
                let node = walk_it(&walk_data).unwrap();
                println!("sim has {} children", node.children.len());
                done.store(true, Ordering::Relaxed);
            });
            s.spawn(|| {
                while !done.load(Ordering::Relaxed) {
                    let files = walk_data.num_files.load(Ordering::Relaxed);
                    let dirs = walk_data.num_dirs.load(Ordering::Relaxed);
                    println!("so far: {files} files, {dirs} dirs");
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }
            });
        });
    }

    #[test]
    fn test_search_cancel() {
        let cancel = AtomicBool::new(false);
        let done = AtomicBool::new(false);
        let ignore = vec![PathBuf::from("/System/Volumes/Data")];
        let walk_data = WalkData::new(Path::new("/"), &ignore, &[], false, || {
            cancel.load(Ordering::Relaxed)
        });
        std::thread::scope(|s| {
            s.spawn(|| {
                let node = walk_it(&walk_data);
                done.store(true, Ordering::Relaxed);
                assert!(node.is_none(), "expected walk to be cancelled");
            });
            s.spawn(|| {
                std::thread::sleep(std::time::Duration::from_millis(100));
                let time = Instant::now();
                cancel.store(true, Ordering::Relaxed);
                while !done.load(Ordering::Relaxed) {
                    std::thread::yield_now();
                }
                // Ensure cancellation happened quickly
                dbg!(time.elapsed());
                assert!(time.elapsed() < Duration::from_secs(1));
            });
        });
    }
}
