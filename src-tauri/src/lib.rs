mod commands;

use commands::serial::{list_serial_ports, send_serial_command};
use commands::printer::{list_printers, print_raw_esc_pos};
use commands::sidecar::{
    check_port_available, cleanup_all_sidecars, get_sidecar_directories, get_sidecar_status,
    list_embedded_sidecars, start_sidecar, stop_sidecar, SidecarManager,
};
use commands::system::{exit_app, get_system_info};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarManager::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // Build Context Menu for System Tray
            let open_i = MenuItem::with_id(app, "open", "Open Nora", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &settings_i, &quit_i])?;

            // Build Tray Icon with Menu & Click Event
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("navigate-to", "/settings");
                        }
                    }
                    "quit" => {
                        let state = app.state::<SidecarManager>();
                        cleanup_all_sidecars(&state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            send_serial_command,
            list_printers,
            print_raw_esc_pos,
            get_system_info,
            exit_app,
            check_port_available,
            start_sidecar,
            stop_sidecar,
            get_sidecar_status,
            get_sidecar_directories,
            list_embedded_sidecars
        ])
        .run(tauri::generate_context!())
        .expect("error while running nora desktop application");
}
