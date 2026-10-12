use std::fs;
use std::path::Path;

fn main() {
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("embedded_sidecars.rs");

    println!("cargo:rerun-if-changed=bin");

    // Scan src-tauri/bin for sidecar binaries to embed into executable
    let bin_dir = Path::new("bin");
    let mut entries_code = Vec::new();

    if bin_dir.exists() && bin_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(bin_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                    let canonical_path = fs::canonicalize(&path)
                        .unwrap_or(path.clone())
                        .to_string_lossy()
                        .replace('\\', "/");

                    println!("cargo:rerun-if-changed={}", path.display());
                    println!("cargo:warning=Embedding sidecar binary: {}", file_name);

                    entries_code.push(format!(
                        r#"("{file_name}", include_bytes!("{canonical_path}"))"#
                    ));
                }
            }
        }
    }

    let code = format!(
        r#"
pub static EMBEDDED_SIDECARS: &[(&str, &[u8])] = &[
    {items}
];
"#,
        items = entries_code.join(",\n    ")
    );

    fs::write(&dest_path, code).unwrap();

    tauri_build::build()
}
