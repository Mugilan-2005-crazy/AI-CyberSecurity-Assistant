# Tauri Icons

This directory contains the application icons for the Tauri desktop build.

## Generating Icons

To generate the required icons, run the following command from the `frontend` directory:

```bash
npx tauri icon public/icons/icon-512x512.png
```

This will generate all required icon files:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

## Requirements

- Source image: `public/icons/icon-512x512.png` (512x512 PNG)
- The source image should be a square PNG with transparency

## Note

The icons are generated at build time. If you're building the desktop app, ensure you run the icon generation command first.