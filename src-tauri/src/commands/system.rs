use serde::{Deserialize, Serialize};

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

use crate::commands::sidecar::{cleanup_all_sidecars, SidecarManager};
use tauri::State;

#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle, sidecar_state: State<'_, SidecarManager>) {
    cleanup_all_sidecars(&sidecar_state);
    app_handle.exit(0);
}
