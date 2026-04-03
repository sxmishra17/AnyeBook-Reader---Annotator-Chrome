# eBook Annotator — Build Instructions

## Overview

eBook Annotator is a Chrome WebExtension (Manifest V3). The extension's own
source code is plain, unminified, human-readable JavaScript. No transpiler,
bundler, or code generator is used on extension code. The `lib/` directory
contains unmodified open-source third-party libraries (see listing below).

---

## Requirements

| Requirement | Version | Installation |
|---|---|---|
| Operating System | Windows 10+, macOS 12+, or Ubuntu 20.04+ | — |
| Chrome | 110 or later | https://www.google.com/chrome/ |

For building a distributable zip:

| Requirement | Version | Notes |
|---|---|---|
| PowerShell | 5+ | Included with Windows 10+ |
| zip (macOS/Linux) | any | Included with most distributions |

---

## Build Steps

### Windows (PowerShell)

```powershell
# Run the build script from the project root
.\build.ps1
```

### macOS / Linux (Bash)

```bash
# Make the build script executable and run it
chmod +x build.sh
./build.sh
```

---

## Loading in Chrome (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this project folder
5. The extension icon will appear in the toolbar

---

## Output

The built extension package is written to:

```
dist/any_ebook_reader_annotater-1.0.0.zip
```

This is the file to upload to the Chrome Web Store.

---

## Project Structure

```
manifest.json          Extension manifest (Manifest V3)
background.js          Service worker — tab capture for snapshots
popup/
  popup.html           Toolbar popup UI
  popup.js             Opens the reader tab on click
reader/
  reader.html          Main reader page layout
  reader.css           Reader styles
  reader.js            App controller — file routing, Foliate/PDF.js/Mammoth init
  highlighter.js       Text selection, highlight creation, note-highlight linking
  sidebar.js           Notes state manager — undo/redo, add/delete/clear
  exporter.js          Export notes to DOCX / PDF / TXT
  snapshot.js          Region screenshot via tab capture
  image-capture.js     Click-to-capture image notes
icons/
  icon-16.png          Toolbar icon (16x16)
  icon-48.png          Extension management icon (48x48)
  icon-96.png          High-res icon (96x96)
  icon-128.png         Chrome Web Store icon (128x128)
  icon-256.png         Source icon (256x256)
  yuvatech_logo.png    Developer branding
lib/                   Third-party libraries (see below — not extension source)
```

---

## Third-Party Libraries (`lib/`)

These files are included unmodified from their respective open-source projects.
They are **not** part of the extension's own source code.

| File(s) | Library | License | Source |
|---|---|---|---|
| `lib/pdfjs/pdf.min.mjs`, `pdf.worker.min.mjs` | PDF.js (Mozilla) | Apache 2.0 | https://github.com/mozilla/pdf.js |
| `lib/foliate/` (all files) | Foliate-js | LGPL-3.0 | https://github.com/johnfactotum/foliate-js |
| `lib/foliate/vendor/fflate.js` | fflate | MIT | https://github.com/101arrowz/fflate |
| `lib/foliate/vendor/zip.js` | zip.js | BSD-3-Clause | https://github.com/gildas-lormeau/zip.js |
| `lib/mammoth.browser.min.js` | Mammoth.js | BSD-2-Clause | https://github.com/mwilliamson/mammoth.js |
| `lib/docx.min.js` | docx | MIT | https://www.npmjs.com/package/docx |
| `lib/jspdf.min.js` | jsPDF | MIT | https://github.com/parallax/jsPDF |
| `lib/FileSaver.min.js` | FileSaver.js | MIT | https://github.com/eligrey/FileSaver.js |

---

## Notes for Chrome Web Store Reviewers

- `script-src blob:` in the CSP is required because PDF.js spawns its worker
  as a `blob:` URL, and Foliate renders EPUB/MOBI/AZW3 sections into `blob:`
  documents. No remote scripts are loaded.
- `innerHTML` assignments in extension code set content from text the user
  selected from a locally opened file. No external data is involved.
- All `eval` / `Function constructor` warnings originate from the third-party
  minified libraries listed above, not extension code.
- The extension makes no network requests. All file processing is local.
- No user data is collected, stored remotely, or transmitted.
