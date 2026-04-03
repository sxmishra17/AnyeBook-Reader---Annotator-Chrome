# eBook Annotator Implementation Guide

This file explains how the extension works, how the code is organized, and how the major features are wired together.

## 1. What This Project Does

The project is a Chrome browser extension that opens and annotates these file types:

- PDF
- EPUB
- MOBI
- AZW3
- DOCX

Core features:

- open supported eBook/document files
- display them inside a custom reader page
- highlight text and save it as notes
- capture images and snapshots into notes
- undo and redo notes operations
- export notes as DOCX, PDF, or TXT

## 2. High-Level Architecture

The app is split into 4 layers:

1. Extension shell
2. Reader UI
3. Format renderers
4. Notes and export system

### 2.1 Extension shell

The extension shell is responsible for:

- registering the extension in Chrome
- exposing popup and reader pages
- handling background-only APIs such as tab capture

Main files:

- `manifest.json`
- `background.js`
- `popup/popup.html`
- `popup/popup.js`

### 2.2 Reader UI

The reader page is the main application screen. It manages:

- toolbar
- page number display
- file loading
- notes sidebar
- selection and highlight actions
- snapshot mode

Main files:

- `reader/reader.html`
- `reader/reader.css`
- `reader/reader.js`

### 2.3 Format renderers

Different formats use different renderers:

- PDF uses `pdfjs`
- EPUB, MOBI, and AZW3 use `foliate`
- DOCX uses `mammoth`

Libraries:

- `lib/pdfjs/*`
- `lib/foliate/*`
- `lib/mammoth.browser.min.js`

### 2.4 Notes and export system

This layer manages note creation, note ordering, undo/redo, and export.

Main files:

- `reader/sidebar.js`
- `reader/highlighter.js`
- `reader/snapshot.js`
- `reader/image-capture.js`
- `reader/exporter.js`

## 3. File-by-File Role

### `manifest.json`

Defines:

- extension metadata
- permissions
- background script
- popup entry
- CSP rules
- web accessible resources

Important points:

- includes permissions for storage, downloads, and screenshot-related behavior
- allows local library files to be loaded by the reader page
- CSP is configured to allow blob/data/frame usage required by EPUB/MOBI rendering
- uses Manifest V3 with a service worker background

### `background.js`

Handles operations that must happen in the extension background context (service worker).

Responsibilities:

- receive messages from the reader page
- capture the visible tab for snapshot functionality

Pattern used:

- `chrome.runtime.onMessage.addListener(...)`
- uses sendResponse callback pattern for async responses (Chrome MV3 requirement)

### `reader/reader.html`

Static UI structure for the main reader page.

Contains:

- toolbar
- page info display
- welcome screen
- file picker
- reader containers for each format
- notes sidebar
- highlight action popup
- modal for export
- toast container

### `reader/reader.css`

All application styling.

Major sections:

- toolbar styles
- welcome screen styles
- PDF layout
- Foliate layout for EPUB/MOBI/AZW3
- DOCX layout
- sidebar styles
- context action styles
- modal, toast, and responsive styles

### `reader/reader.js`

Main controller of the application.

Responsibilities:

- detect selected file type
- route file to the correct renderer
- track current page/location
- toggle note-taking mode
- connect highlight, image capture, snapshot, and sidebar modules
- navigate to a page when a note requests it

This file is the central orchestrator.

### `reader/highlighter.js`

Responsible for text selection behavior.

Responsibilities:

- detect selected text
- show the floating “Highlight & Copy to Notes” action
- create visible highlights in the document
- connect highlights to note IDs
- remove or restore highlights when notes are deleted, undone, or redone

Highlight behavior differs by format:

- PDF: uses absolutely positioned overlay divs
- DOCX: wraps selected text in `<mark>` nodes
- EPUB/MOBI/AZW3: wraps selected text in iframe document `<mark>` nodes

### `reader/sidebar.js`

Responsible for note storage in memory and note UI rendering.

Responsibilities:

- hold note array
- render note list
- open/close sidebar
- undo/redo operations
- note deletion
- note reorder via drag and drop
- show note context menu

This module is the note state manager for the UI layer.

### `reader/snapshot.js`

Responsible for region-based screenshot capture.

Responsibilities:

- enable snapshot selection mode
- draw selection box overlay
- ask background script for visible tab image
- crop selected area to a canvas
- add the result to notes as an image note

### `reader/image-capture.js`

Handles direct image capture when a user clicks an image inside the content.

### `reader/exporter.js`

Handles exporting the notes list to:

- DOCX
- PDF
- TXT

Current file naming pattern:

- `Notes_{bookname}.docx`
- `Notes_{bookname}.pdf`
- `Notes_{bookname}.txt`

## 4. Format Loading Flow

When the user selects a file:

1. `reader.js` reads the chosen file.
2. The extension determines the format from the extension name.
3. The reader routes the file to the correct loader.
4. The correct container becomes visible.
5. Highlight, image capture, snapshot, and sidebar modules are initialized.

### 4.1 PDF flow

PDF loading path:

1. `loadPDF(file)` is called.
2. `pdfjs` loads the PDF document.
3. Each page is rendered to a canvas.
4. A text layer is placed above the canvas for text selection.
5. Scroll position updates the page number in the toolbar.

Why PDF highlighting is special:

- text is not highlighted inside the PDF canvas itself
- instead, transparent text selection is used to compute rectangles
- overlay divs are added on top of the PDF page wrapper

### 4.2 EPUB / MOBI / AZW3 flow

These formats use Foliate.

Loading path:

1. `loadFoliate(file, format)` is called.
2. `lib/foliate/view.js` is dynamically imported.
3. A `<foliate-view>` custom element is created.
4. `foliateView.open(file)` loads the book.
5. The renderer is configured for scrolling mode.
6. Foliate `load` and `relocate` events are used to keep UI state updated.

Important implementation details:

- EPUB/MOBI content lives inside iframe documents managed by Foliate
- selection and input events inside those iframe documents do not bubble to the parent window
- because of that, listeners must be attached inside each iframe document on Foliate `load`

Current reading mode:

- single-page scroll mode, not spread/double-page mode

Current page number source:

- toolbar uses Foliate `location.current` and `location.total` when available
- falls back to section information if necessary

### 4.3 DOCX flow

DOCX loading path:

1. `loadDocx(file)` is called.
2. `mammoth` converts the document into HTML.
3. The HTML is inserted into `#docx-container`.
4. Page numbers are estimated from scroll height.

DOCX does not have real page coordinates after conversion, so page numbering is approximate.

## 5. How Highlighting Works

### 5.1 Common flow

For all formats, the note-taking flow is:

1. user enables note-taking
2. user selects text
3. a floating action appears near the selection
4. user clicks the action
5. visible highlight is created
6. note is created in the sidebar
7. the created highlight is tagged with the note ID

This note ID link is what makes undo/delete/redo synchronize with the visual highlight.

### 5.2 PDF highlights

PDF highlight model:

- selection range is converted into client rectangles
- each rectangle becomes a `.pdf-highlight-overlay` element
- those elements are tagged with `data-note-id`

### 5.3 DOCX highlights

DOCX highlight model:

- selected text nodes are wrapped in `<mark class="ebook-highlight">`
- the `<mark>` nodes are tagged with `data-note-id`

### 5.4 EPUB / MOBI / AZW3 highlights

Because Foliate content lives inside iframes:

- the current selection is captured inside the iframe document
- the range is cloned before the selection disappears
- clicking the action applies `<mark>` wrappers inside the iframe DOM
- those wrappers are tagged with `data-note-id`

## 6. Undo / Redo Design

Undo and redo are handled in `sidebar.js`.

State:

- `notes[]`
- `undoStack[]`
- `redoStack[]`

Action types:

- `add`
- `delete`
- `move`
- `clear`

Current behavior:

- undo remove note -> hide/remove corresponding highlight
- redo restore note -> restore corresponding highlight
- manual delete note -> remove corresponding highlight
- clear all -> remove all corresponding highlights
- undo clear -> restore notes and restore highlights

The visual highlight now stays synchronized with note operations.

## 7. Snapshot Design

Snapshot flow:

1. user enables snapshot mode
2. user drags a region
3. reader hides the selection overlay
4. reader asks background script to capture the visible tab
5. returned image is cropped on a canvas
6. cropped image is added as an image note

Why background capture is used:

- it works across the rendered reader page
- captureVisibleTab is the standard Chrome API for this use case

## 8. Export Design

Export entry point is `reader/exporter.js`.

### DOCX export

- uses `docx`
- creates a title block, generated date, separator, and note content
- embeds captured images where available

### PDF export

- uses `jsPDF`
- renders title, generated date, separator, text notes, and embedded images

### TXT export

- plain text summary of notes
- includes page number labels when enabled

## 9. Notes About Page Numbers

Page numbers differ by format:

- PDF: real page numbers from the document
- DOCX: estimated page numbers based on scroll height
- EPUB/MOBI/AZW3: generated reading locations/pages from Foliate

This means page numbers are exact for PDF, approximate for DOCX, and reader-generated for Foliate-backed formats.

## 10. How The Code Is Structured

The code follows a modular browser-script pattern instead of bundling.

Characteristics:

- each feature lives in its own file
- modules are built as IIFEs such as `const Sidebar = (() => { ... })();`
- global objects are used to connect feature modules together
- the reader page loads scripts in dependency order through `reader.html`

Why this structure works here:

- simple for a browser extension without a build step
- easy to debug in the browser devtools
- local feature ownership is clear

Tradeoff:

- there is shared global coupling between modules
- adding complex state can become harder than in a bundled module architecture

## 11. Current Dependency Direction

Simplified dependency map:

- `reader.html` loads scripts
- `reader.js` orchestrates all runtime behavior
- `highlighter.js` depends on `Sidebar`
- `snapshot.js` depends on `Sidebar` and background messaging
- `image-capture.js` depends on `Sidebar`
- `exporter.js` depends on note data passed in by the reader flow

## 12. Important Runtime Events

Examples of key events used in the project:

- file input `change`
- document `keydown`
- document `mouseup`
- document `selectionchange`
- Foliate `load`
- Foliate `relocate`
- sidebar drag/drop events

## 13. Suggested Future Refactors

If this project grows further, these would be good next refactors:

1. move shared reader state into one explicit state manager
2. replace ad-hoc globals with ES modules and a lightweight build step
3. persist notes and highlights per book in storage
4. persist enough highlight metadata to recreate highlights after a full reload
5. add automated tests for note undo/redo and page tracking

## 14. Summary

In short:

- `reader.js` is the central controller
- each file format has its own load path
- highlights and notes are now linked by note ID
- undo/redo keeps note UI and highlight UI synchronized
- exports use `Notes_{bookname}` naming
- EPUB/MOBI/AZW3 use Foliate and require iframe-aware event handling

This file should be the first place to read before changing behavior in the reader.