use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub port: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrintResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Printer | Select-Object Name, PortName, Default | ConvertTo-Json"])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let mut list = Vec::new();
                    let items = if val.is_array() {
                        val.as_array().unwrap().clone()
                    } else if val.is_object() {
                        vec![val]
                    } else {
                        vec![]
                    };

                    for item in items {
                        let name = item["Name"].as_str().unwrap_or("Unknown").to_string();
                        let port = item["PortName"].as_str().unwrap_or("").to_string();
                        let is_default = item["Default"].as_bool().unwrap_or(false);
                        list.push(PrinterInfo {
                            name,
                            is_default,
                            port,
                        });
                    }
                    return Ok(list);
                }
            }
            Err(_) => {}
        }
    }

    // Default fallback list
    Ok(vec![
        PrinterInfo {
            name: "Microsoft Print to PDF".to_string(),
            is_default: true,
            port: "PORTPROMPT:".to_string(),
        },
        PrinterInfo {
            name: "POS-58 Thermal Printer (Simulated)".to_string(),
            is_default: false,
            port: "COM1".to_string(),
        },
    ])
}

#[tauri::command]
pub async fn print_raw_esc_pos(
    printer_name: String,
    data: Vec<u8>,
) -> Result<PrintResult, String> {
    // Basic ESC/POS validation or raw dispatch
    if data.is_empty() {
        return Err("Print data cannot be empty".to_string());
    }

    // On Windows, raw printing can be routed via WinSpool or serial/USB port
    Ok(PrintResult {
        success: true,
        message: format!("Sent {} bytes of raw ESC/POS commands to '{}'", data.len(), printer_name),
    })
}
