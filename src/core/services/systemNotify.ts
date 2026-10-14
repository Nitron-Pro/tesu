/**
 * Windows toast via Tauri notification plugin.
 * Returns a short status string so Settings can show success or the real error.
 * Unpackaged `tauri dev` builds often get permission "granted" but Windows still
 * hides the toast until the app is installed (Start Menu shortcut / AUMID).
 */
export async function sendWindowsTestNotification(
  title: string,
  body: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (!granted) {
      return { ok: false, detail: "permission-denied" };
    }

    await sendNotification({ title, body });
    return { ok: true, detail: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: message || "unknown-error" };
  }
}
