Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 128, 128
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.Clear([System.Drawing.Color]::FromArgb(24, 24, 27))
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 250, 250))
$font = New-Object System.Drawing.Font('Segoe UI', 60, [System.Drawing.FontStyle]::Bold)
$graphics.DrawString('N', $font, $brush, 28, 15)

$bmp.Save('src-tauri/icons/128x128.png', [System.Drawing.Imaging.ImageFormat]::Png)

$bmp32 = New-Object System.Drawing.Bitmap $bmp, 32, 32
$bmp32.Save('src-tauri/icons/32x32.png', [System.Drawing.Imaging.ImageFormat]::Png)

$bmp256 = New-Object System.Drawing.Bitmap $bmp, 256, 256
$bmp256.Save('src-tauri/icons/128x128@2x.png', [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Save('src-tauri/icons/icon.ico', [System.Drawing.Imaging.ImageFormat]::Icon)
$bmp.Save('src-tauri/icons/icon.icns', [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Icons generated successfully in src-tauri/icons"
