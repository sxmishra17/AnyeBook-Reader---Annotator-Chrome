#!/usr/bin/env bash
# build.sh — eBook Annotator Chrome Extension Build Script (macOS / Linux)
#
# Requirements: zip utility
# Usage: chmod +x build.sh && ./build.sh

set -euo pipefail

ARTIFACTS_DIR="${1:-dist}"
ZIP_NAME="any_ebook_reader_annotater-1.0.0.zip"
ZIP_PATH="$ARTIFACTS_DIR/$ZIP_NAME"

echo "eBook Annotator — Chrome Extension Builder"
echo ""

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

# Remove old build
rm -f "$ZIP_PATH"

# Create zip with required files only
echo "Creating zip archive..."
zip -r "$ZIP_PATH" \
    manifest.json \
    background.js \
    popup/ \
    reader/ \
    lib/ \
    icons/ \
    -x "*.md" "*.ps1" "*.sh" "dist/*"

echo ""
echo "Build complete: $ZIP_PATH"
echo ""
echo "To install in Chrome:"
echo "  1. Go to chrome://extensions/"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked' and select this project folder"
echo "  (or upload the .zip to the Chrome Web Store)"
