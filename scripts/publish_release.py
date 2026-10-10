import json
import urllib.request
import urllib.parse
import os
import subprocess

def get_git_credentials():
    proc = subprocess.Popen(
        ["git", "credential", "fill"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, _ = proc.communicate("protocol=https\nhost=github.com\n")
    creds = {}
    for line in stdout.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            creds[k.strip()] = v.strip()
    return creds

def create_github_release():
    creds = get_git_credentials()
    token = creds.get("password")
    if not token:
        print("Error: Could not retrieve GitHub token from git credentials")
        return

    repo = "Nitron-Pro/tesu"
    tag = "v1.1.0"
    title = "Tesu Trader v1.1.0"
    body = """# 🚀 Tesu Trader v1.1.0

نسخه جدید سامانه معاملاتی الگوریتمی تسو تریدر بر پایه فریم‌ورک دسکتاپ نورا با قابلیت‌های ارتقایافته زیر منتشر شد:

### 🌟 قابلیت‌های نسخه ۱.۱.۰:
- **مدیریت چندگانه و همزمان پایانه‌های متاتریدر ۵:** تعریف و ذخیره‌سازی چندین پایانه MT5 با تفکیک مسیر فایل اجرایی و اکانت‌های متعدد برای هر پایانه.
- **توقف و آرشیو ایمن ربات‌ها:** توقف خودکار کلیه سفارشات و ربات‌های فعال جاری هنگام سوئیچ به متاتریدر یا اکانت دیگر جهت جلوگیری از تداخل.
- **باندل مستقل پایتون (Standalone Engine Executable):** اجرای بدون وابستگی و بدون نیاز به نصب پایتون در سیستم‌های مقصد (فایل مستقل `engine.exe`).
- **نشانگرهای زنده وضعیت:** نمایش نام متاتریدر متصل و شماره اکانت فعال در هدر و تایتل‌بار ویندوز.
- **اتصال سرور آپدیتر ریموت:** اتصال سیستم به‌روزرسانی به سرور اختصاصی دامنه نایترون (`app.nitron.pro`).

### 📦 فایل‌های پیوست جهت دانلود:
- **Tesu_Trader_1.1.0_Setup.exe**: فایل نصبی خودکار ویندوز.
- **Tesu_Trader.exe**: نسخه پرتابل و بدون نیاز به نصب (Portable).
- **Tesu_Trader_1.1.0.msi**: اینستالر استاندارد سازمانی.
"""

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Tesu-Release-Publisher"
    }

    # 1. Create Release
    create_url = f"https://api.github.com/repos/{repo}/releases"
    payload = {
        "tag_name": tag,
        "name": title,
        "body": body,
        "draft": False,
        "prerelease": False
    }

    req = urllib.request.Request(
        create_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            rel_data = json.loads(resp.read().decode("utf-8"))
            print(f"Created release: {rel_data.get('html_url')}")
            upload_url_template = rel_data.get("upload_url", "")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"Failed to create release: {e.code} - {err_msg}")
        return

    # Base upload URL (strip {?name,label})
    base_upload_url = upload_url_template.split("{")[0]

    # Files to attach
    files_to_upload = [
        ("build_output/Tesu_Trader_1.1.0_Setup.exe", "application/vnd.microsoft.portable-executable"),
        ("build_output/Tesu_Trader.exe", "application/vnd.microsoft.portable-executable"),
        ("build_output/Tesu_Trader_1.1.0.msi", "application/x-msi"),
    ]

    for file_path, content_type in files_to_upload:
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            continue

        filename = os.path.basename(file_path)
        print(f"Uploading asset: {filename}...")
        url = f"{base_upload_url}?name={urllib.parse.quote(filename)}"

        with open(file_path, "rb") as f:
            file_data = f.read()

        up_headers = {
            "Authorization": f"token {token}",
            "Content-Type": content_type,
            "User-Agent": "Tesu-Release-Publisher",
            "Content-Length": str(len(file_data))
        }

        up_req = urllib.request.Request(url, data=file_data, headers=up_headers, method="POST")
        try:
            with urllib.request.urlopen(up_req) as up_resp:
                res = json.loads(up_resp.read().decode("utf-8"))
                print(f"Successfully uploaded: {filename} ({res.get('browser_download_url')})")
        except urllib.error.HTTPError as e:
            print(f"Failed to upload {filename}: {e.code} - {e.read().decode('utf-8')}")

if __name__ == "__main__":
    create_github_release()
