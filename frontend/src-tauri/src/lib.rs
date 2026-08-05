#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;

/// Command to get the backend API URL from environment
#[tauri::command]
fn get_api_url() -> String {
  std::env::var("VITE_API_URL").unwrap_or_else(|_| String::from("http://localhost:5000"))
}

/// Command to get the WebSocket URL from environment
#[tauri::command]
fn get_socket_url() -> String {
  std::env::var("VITE_SOCKET_URL").unwrap_or_else(|_| String::from("http://localhost:5000"))
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // Set initial window title
      let window = app.get_webview_window("main").unwrap();
      window.set_title("Enterprise Cyber Security Platform").unwrap();

      #[cfg(debug_assertions)]
      {
        window.open_devtools();
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_api_url, get_socket_url])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}