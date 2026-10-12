use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Include the generated embedded sidecars table from build.rs
include!(concat!(env!("OUT_DIR"), "/embedded_sidecars.rs"));

// Flag to hide terminal console window on Windows
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct SidecarManager(pub Mutex<HashMap<String, Child>>);

#[derive(Debug, Serialize, Deserialize)]
pub struct SidecarStatus {
    pub name: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub message: String,
}

/// Automatically extracts embedded sidecar binary to AppLocalData if present in EMBEDDED_SIDECARS
pub fn ensure_embedded_sidecar_extracted(app_handle: &AppHandle, command: &str) -> Option<PathBuf> {
    let clean_name = Path::new(command)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| command.to_string());

    // Search in EMBEDDED_SIDECARS
    for (embedded_name, bytes) in EMBEDDED_SIDECARS {
        let is_match = *embedded_name == clean_name
            || *embedded_name == format!("{}.exe", clean_name)
            || format!("{}.exe", *embedded_name) == clean_name;

        if is_match {
            if let Ok(local_data) = app_handle.path().app_local_data_dir() {
                let target_dir = local_data.join("bin");
                let _ = fs::create_dir_all(&target_dir);
                let target_path = target_dir.join(embedded_name);

                // Write file if not exists or if size differs
                let should_write = match fs::metadata(&target_path) {
                    Ok(meta) => meta.len() != bytes.len() as u64,
                    Err(_) => true,
                };

                if should_write {
                    if let Err(e) = fs::write(&target_path, bytes) {
                        eprintln!(
                            "Failed to extract embedded sidecar '{}': {}",
                            target_path.display(),
                            e
                        );
                    } else {
                        println!(
                            "Successfully extracted embedded sidecar '{}' to '{}'",
                            embedded_name,
                            target_path.display()
                        );
                    }
                }

                if target_path.exists() {
                    return Some(target_path);
                }
            }
        }
    }

    None
}

/// Helper function to locate a binary across standard application search paths:
/// 1. As an absolute or current directory path
/// 2. Extracted from compiled-in EMBEDDED_SIDECARS into %LOCALAPPDATA%
/// 3. Next to the main executable (current_exe dir)
/// 4. In app_data_dir / app_local_data_dir (e.g. %APPDATA%/com.appName/bin/ or engines/)
/// 5. In resource_dir (bundled sidecars)
/// 6. In standard system PATH
pub fn resolve_sidecar_path(app_handle: &AppHandle, command: &str) -> PathBuf {
    let raw_path = Path::new(command);
    if raw_path.is_absolute() && raw_path.exists() {
        return raw_path.to_path_buf();
    }

    // 1. Check relative to current working directory
    if raw_path.exists() {
        return raw_path.to_path_buf();
    }

    // 2. Check if it's an embedded binary compiled into the executable via include_bytes!
    if let Some(extracted_path) = ensure_embedded_sidecar_extracted(app_handle, command) {
        return extracted_path;
    }

    // 3. Check next to running executable (ideal for portable .exe & sidecars in same folder or subfolder)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join(command);
            if candidate.exists() {
                return candidate;
            }
            // Also try with .exe if omitted on Windows
            #[cfg(windows)]
            {
                let with_exe = exe_dir.join(format!("{}.exe", command));
                if with_exe.exists() {
                    return with_exe;
                }
            }
        }
    }

    // 4. Check in AppLocalData / AppData (standard location for embedded / extracted binaries)
    if let Ok(app_local_data) = app_handle.path().app_local_data_dir() {
        let candidate = app_local_data.join(command);
        if candidate.exists() {
            return candidate;
        }
        let candidate_bin = app_local_data.join("bin").join(command);
        if candidate_bin.exists() {
            return candidate_bin;
        }
        let candidate_engines = app_local_data.join("engines").join(command);
        if candidate_engines.exists() {
            return candidate_engines;
        }
    }

    // 5. Check in AppData (Roaming)
    if let Ok(app_data) = app_handle.path().app_data_dir() {
        let candidate = app_data.join(command);
        if candidate.exists() {
            return candidate;
        }
        let candidate_bin = app_data.join("bin").join(command);
        if candidate_bin.exists() {
            return candidate_bin;
        }
    }

    // 6. Check in bundled resource dir
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let candidate = resource_dir.join(command);
        if candidate.exists() {
            return candidate;
        }
        let candidate_bin = resource_dir.join("bin").join(command);
        if candidate_bin.exists() {
            return candidate_bin;
        }
    }

    // Default: return original string to let the OS PATH resolve it
    PathBuf::from(command)
}

/// Returns the list of binaries embedded into the executable
#[tauri::command]
pub fn list_embedded_sidecars() -> Result<Vec<String>, String> {
    Ok(EMBEDDED_SIDECARS
        .iter()
        .map(|(name, _)| name.to_string())
        .collect())
}

/// Returns the standard application directories for sidecars / data storage
#[tauri::command]
pub fn get_sidecar_directories(app_handle: AppHandle) -> Result<HashMap<String, String>, String> {
    let mut dirs = HashMap::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            dirs.insert("exe_dir".to_string(), exe_dir.to_string_lossy().to_string());
        }
    }

    if let Ok(local_data) = app_handle.path().app_local_data_dir() {
        dirs.insert(
            "app_local_data_dir".to_string(),
            local_data.to_string_lossy().to_string(),
        );
        let bin_dir = local_data.join("bin");
        dirs.insert(
            "suggested_bin_dir".to_string(),
            bin_dir.to_string_lossy().to_string(),
        );
    }

    if let Ok(data) = app_handle.path().app_data_dir() {
        dirs.insert(
            "app_data_dir".to_string(),
            data.to_string_lossy().to_string(),
        );
    }

    if let Ok(resource) = app_handle.path().resource_dir() {
        dirs.insert(
            "resource_dir".to_string(),
            resource.to_string_lossy().to_string(),
        );
    }

    Ok(dirs)
}

/// Check if a specific TCP port is free on localhost
#[tauri::command]
pub fn check_port_available(port: u16) -> Result<bool, String> {
    match TcpListener::bind(("127.0.0.1", port)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Generic Sidecar starter: starts any external binary/executable
/// Works for Python, Go, Node, C++ binaries
/// Automatically resolves relative paths against embedded binaries, exe_dir, AppData, and resource_dir.
#[tauri::command]
pub fn start_sidecar(
    app_handle: AppHandle,
    name: String,
    command: String,
    args: Vec<String>,
    working_dir: Option<String>,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let mut processes = state.0.lock().map_err(|e| e.to_string())?;

    // If already running, check if process is still alive
    if let Some(child) = processes.get_mut(&name) {
        match child.try_wait() {
            Ok(None) => {
                return Ok(SidecarStatus {
                    name: name.clone(),
                    running: true,
                    pid: Some(child.id()),
                    message: "Process is already running".to_string(),
                });
            }
            Ok(Some(_)) | Err(_) => {
                // Process terminated, remove it from map
                processes.remove(&name);
            }
        }
    }

    // Resolve binary path across standard locations (including embedded extraction)
    let resolved_path = resolve_sidecar_path(&app_handle, &command);

    let mut cmd = Command::new(&resolved_path);
    cmd.args(&args);

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    } else if let Some(parent) = resolved_path.parent() {
        // Default working directory to the binary's directory if it exists on disk
        if parent.exists() && parent.as_os_str().len() > 0 {
            cmd.current_dir(parent);
        }
    }

    // Hide console window on Windows
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            processes.insert(name.clone(), child);
            Ok(SidecarStatus {
                name,
                running: true,
                pid: Some(pid),
                message: format!(
                    "Sidecar started successfully from: {}",
                    resolved_path.display()
                ),
            })
        }
        Err(e) => Err(format!(
            "Failed to start sidecar '{}' (resolved: '{}'): {}",
            command,
            resolved_path.display(),
            e
        )),
    }
}

/// Stop a running sidecar by name
#[tauri::command]
pub fn stop_sidecar(
    name: String,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let mut processes = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = processes.remove(&name) {
        let _ = child.kill();
        let _ = child.wait();
        Ok(SidecarStatus {
            name,
            running: false,
            pid: None,
            message: "Sidecar stopped".to_string(),
        })
    } else {
        Ok(SidecarStatus {
            name,
            running: false,
            pid: None,
            message: "Sidecar was not active".to_string(),
        })
    }
}

/// Query status of a sidecar by name
#[tauri::command]
pub fn get_sidecar_status(
    name: String,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let mut processes = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(child) = processes.get_mut(&name) {
        match child.try_wait() {
            Ok(None) => Ok(SidecarStatus {
                name,
                running: true,
                pid: Some(child.id()),
                message: "Running".to_string(),
            }),
            Ok(Some(exit_code)) => {
                processes.remove(&name);
                Ok(SidecarStatus {
                    name,
                    running: false,
                    pid: None,
                    message: format!("Exited with code: {}", exit_code),
                })
            }
            Err(e) => {
                processes.remove(&name);
                Ok(SidecarStatus {
                    name,
                    running: false,
                    pid: None,
                    message: format!("Error checking status: {}", e),
                })
            }
        }
    } else {
        Ok(SidecarStatus {
            name,
            running: false,
            pid: None,
            message: "Not running".to_string(),
        })
    }
}

/// Stop and clean up all active sidecars (called automatically during app exit)
pub fn cleanup_all_sidecars(state: &SidecarManager) {
    if let Ok(mut processes) = state.0.lock() {
        for (name, mut child) in processes.drain() {
            println!("Cleaning up sidecar process: {}", name);
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
