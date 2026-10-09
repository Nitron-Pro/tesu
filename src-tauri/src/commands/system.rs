use serde::{Deserialize, Serialize};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub fn start_python_engine() -> Result<String, String> {
    // Determine path to engine/main.py
    // Priority:
    // 1. Current working directory / engine / main.py
    // 2. Relative to executable directory / engine / main.py
    let current_dir = std::env::current_dir().unwrap_or_default();
    let candidate1 = current_dir.join("engine").join("main.py");
    
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();
    let candidate2 = exe_dir.join("engine").join("main.py");
    // Also if exe is in build_output or target/release, check parent dirs
    let candidate3 = exe_dir.parent().unwrap_or(&exe_dir).join("engine").join("main.py");

    let script_path = if candidate1.exists() {
        candidate1
    } else if candidate2.exists() {
        candidate2
    } else if candidate3.exists() {
        candidate3
    } else {
        candidate1
    };

    let working_dir = script_path.parent().unwrap_or(&current_dir);

    #[cfg(target_os = "windows")]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Check if python is already running engine/main.py or port 9182 is listening
    // We can spawn pythonw (windowless) or python with CREATE_NO_WINDOW
    let mut cmd = Command::new("pythonw");
    cmd.arg(&script_path);
    cmd.current_dir(working_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.spawn() {
        Ok(child) => Ok(format!("Python engine started via pythonw with PID: {}", child.id())),
        Err(_) => {
            let mut cmd2 = Command::new("python");
            cmd2.arg(&script_path);
            cmd2.current_dir(working_dir);

            #[cfg(target_os = "windows")]
            cmd2.creation_flags(CREATE_NO_WINDOW);

            match cmd2.spawn() {
                Ok(child) => Ok(format!("Python engine started with PID: {}", child.id())),
                Err(e) => {
                    // Try 'py' launcher if 'python' fails
                    let mut py_cmd = Command::new("py");
                    py_cmd.arg(&script_path);
                    py_cmd.current_dir(working_dir);

                    #[cfg(target_os = "windows")]
                    py_cmd.creation_flags(CREATE_NO_WINDOW);

                    match py_cmd.spawn() {
                        Ok(child) => Ok(format!("Python engine started via py with PID: {}", child.id())),
                        Err(err2) => Err(format!("Failed to start python: {} | py fallback: {}", e, err2)),
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}
