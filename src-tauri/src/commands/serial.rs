use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::io::{Read, Write};

#[derive(Debug, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub port_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendCommandResponse {
    pub success: bool,
    pub bytes_written: usize,
    pub response: String,
}

#[tauri::command]
pub async fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    match serialport::available_ports() {
        Ok(ports) => {
            let result = ports
                .into_iter()
                .map(|p| {
                    let port_type = match p.port_type {
                        serialport::SerialPortType::UsbPort(info) => {
                            format!("USB (VID: {:04x}, PID: {:04x})", info.vid, info.pid)
                        }
                        serialport::SerialPortType::PciPort => "PCI Port".to_string(),
                        serialport::SerialPortType::BluetoothPort => "Bluetooth Port".to_string(),
                        serialport::SerialPortType::Unknown => "Unknown Port".to_string(),
                    };
                    SerialPortInfo {
                        port_name: p.port_name,
                        port_type,
                    }
                })
                .collect();
            Ok(result)
        }
        Err(e) => Err(format!("Failed to scan serial ports: {}", e)),
    }
}

#[tauri::command]
pub async fn send_serial_command(
    port_name: String,
    baud_rate: u32,
    command: String,
    timeout_ms: u64,
) -> Result<SendCommandResponse, String> {
    let port_builder = serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(timeout_ms));

    match port_builder.open() {
        Ok(mut port) => {
            let command_bytes = command.as_bytes();
            if let Err(e) = port.write_all(command_bytes) {
                return Err(format!("Failed to write to port {}: {}", port_name, e));
            }

            // Attempt to read reply (if any device responds)
            let mut buffer: Vec<u8> = vec![0; 1024];
            let bytes_read = match port.read(&mut buffer) {
                Ok(n) => n,
                Err(_) => 0, // Timeout or no response, normal for one-way commands
            };

            let response = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();

            Ok(SendCommandResponse {
                success: true,
                bytes_written: command_bytes.len(),
                response,
            })
        }
        Err(e) => Err(format!("Failed to open serial port {}: {}", port_name, e)),
    }
}
