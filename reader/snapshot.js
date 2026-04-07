/**
 * snapshot.js — Region Snapshot Tool
 * Provides a crosshair cursor to drag-select a region of the reader,
 * captures it as an image, and sends it to the notes sidebar.
 */
const Snapshot = (() => {
  let active = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let getPageFn = null;

  // Overlay elements
  let overlay = null;
  let selectionBox = null;

  function init(getPageFunc) {
    getPageFn = getPageFunc;
    createOverlay();
  }

  function getCurrentPage() {
    if (getPageFn) return getPageFn();
    return '?';
  }

  /**
   * Create the fullscreen overlay and selection rectangle
   */
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'snapshot-overlay';
    overlay.className = 'snapshot-overlay';

    selectionBox = document.createElement('div');
    selectionBox.className = 'snapshot-selection';
    overlay.appendChild(selectionBox);

    // Instruction hint
    const hint = document.createElement('div');
    hint.className = 'snapshot-hint';
    hint.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
      Drag to select a region &nbsp;·&nbsp; Press <kbd>Esc</kbd> to cancel
    `;
    overlay.appendChild(hint);

    document.body.appendChild(overlay);

    // Mouse events
    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);

    // Escape to cancel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && active) {
        deactivate();
      }
    });
  }

  /**
   * Activate snapshot mode — show overlay with crosshair
   */
  function activate() {
    if (active) return;
    active = true;
    overlay.classList.add('active');
    selectionBox.style.display = 'none';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    document.getElementById('btn-snapshot')?.classList.add('active');
  }

  /**
   * Deactivate snapshot mode — hide overlay
   */
  function deactivate() {
    active = false;
    dragging = false;
    overlay.classList.remove('active');
    selectionBox.style.display = 'none';
    document.getElementById('btn-snapshot')?.classList.remove('active');
  }

  function onMouseDown(e) {
    if (!active) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }

  function onMouseMove(e) {
    if (!dragging) return;
    e.preventDefault();

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    selectionBox.style.width = w + 'px';
    selectionBox.style.height = h + 'px';
  }

  function onMouseUp(e) {
    if (!dragging) return;
    e.preventDefault();
    dragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    // Ignore very small selections (accidental clicks)
    if (w < 10 || h < 10) {
      selectionBox.style.display = 'none';
      return;
    }

    // Hide the full-screen overlay so it doesn't appear in the screenshot.
    // 350 ms allows the browser to fully composite the repaint before the
    // background script takes the tab screenshot.
    overlay.classList.remove('active');
    selectionBox.style.display = 'none';

    setTimeout(() => {
      captureRegion(x, y, w, h);
      deactivate();
    }, 350);
  }

  /**
   * Capture a region of the page using html2canvas-style approach
   * We use the reader area's content to render onto an offscreen canvas
   */
  function captureRegion(x, y, w, h) {
    const readerArea = document.getElementById('reader-area');

    // Try to find the visible content to screenshot
    // We'll use a combination of canvas elements (for PDF) and html-to-canvas for others
    const page = getCurrentPage();

    // Strategy 1: Check if we're in PDF mode — use canvas directly
    const pdfContainer = document.getElementById('pdf-container');
    if (pdfContainer && pdfContainer.style.display !== 'none') {
      capturePDFRegion(pdfContainer, x, y, w, h, page);
    } else {
      // Strategy 2: EPUB/MOBI and DOCX — use captureVisibleTab directly.
      // Extension pages have access to chrome.tabs API, so we call it
      // directly instead of routing through the background service worker.
      captureViaTab(x, y, w, h, page);
    }
  }

  /**
   * Capture by calling chrome.tabs.captureVisibleTab() directly from
   * the extension page. This avoids permission issues with service
   * worker routing in Chrome MV3.
   * x, y, w, h are CSS-pixel viewport coordinates of the desired region.
   */
  async function captureViaTab(x, y, w, h, page) {
    try {
      // Call captureVisibleTab directly from the extension page
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      if (!dataUrl) {
        console.error('captureVisibleTab returned empty');
        fallbackCapture(null, w, h, page);
        return;
      }

      const img = new Image();
      img.onload = () => {
        // captureVisibleTab returns the screenshot at device-pixel resolution.
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          Math.round(x * dpr), Math.round(y * dpr),
          Math.round(w * dpr), Math.round(h * dpr),
          0, 0, w, h
        );
        Sidebar.addImageNote(canvas.toDataURL('image/png'), page);
        // Free GPU-backed canvas resources immediately
        canvas.width = 0; canvas.height = 0;
      };
      img.onerror = () => fallbackCapture(w, h, page);
      img.src = dataUrl;
    } catch (err) {
      console.warn('captureViaTab failed:', err);
      fallbackCapture(w, h, page);
    }
  }

  /**
   * Capture from PDF canvas elements
   */
  function capturePDFRegion(container, x, y, w, h, page) {
    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = w * window.devicePixelRatio;
    captureCanvas.height = h * window.devicePixelRatio;
    const ctx = captureCanvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    let captured = false;

    for (const wrapper of wrappers) {
      const canvas = wrapper.querySelector('canvas');
      if (!canvas) continue;

      const canvasRect = canvas.getBoundingClientRect();

      // Check if this canvas overlaps with the selection
      const overlapX = Math.max(x, canvasRect.left);
      const overlapY = Math.max(y, canvasRect.top);
      const overlapRight = Math.min(x + w, canvasRect.right);
      const overlapBottom = Math.min(y + h, canvasRect.bottom);

      if (overlapX < overlapRight && overlapY < overlapBottom) {
        // There's an overlap — draw the relevant portion
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;

        const sx = (overlapX - canvasRect.left) * scaleX;
        const sy = (overlapY - canvasRect.top) * scaleY;
        const sw = (overlapRight - overlapX) * scaleX;
        const sh = (overlapBottom - overlapY) * scaleY;

        const dx = overlapX - x;
        const dy = overlapY - y;
        const dw = overlapRight - overlapX;
        const dh = overlapBottom - overlapY;

        ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh);
        captured = true;
      }
    }

    if (captured) {
      const dataUrl = captureCanvas.toDataURL('image/png');
      Sidebar.addImageNote(dataUrl, page);
    } else {
      showToast('Could not capture — no content in selected area');
    }
    // Free GPU-backed canvas resources immediately
    captureCanvas.width = 0; captureCanvas.height = 0;
  }

  /**
   * Fallback: Create a placeholder image when HTML capture fails
   */
  function fallbackCapture(w, h, page) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1c1c30';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#667eea';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Snapshot from Page ${page}`, w / 2, h / 2);
    ctx.fillText(`${w}×${h}px`, w / 2, h / 2 + 20);

    const dataUrl = canvas.toDataURL('image/png');
    Sidebar.addImageNote(dataUrl, page);
    // Free GPU-backed canvas resources immediately
    canvas.width = 0; canvas.height = 0;
  }

  async function toggle() {
    if (active) {
      deactivate();
    } else {
      // captureVisibleTab (used for EPUB/MOBI/DOCX snapshots) requires host
      // permission. Request it here while we still have the user gesture context.
      try {
        const has = await chrome.permissions.contains({ origins: ['<all_urls>'] });
        if (!has) {
          const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
          if (!granted) {
            showToast('Screen capture permission is needed for snapshots');
            return;
          }
        }
      } catch (_) { /* permissions API unavailable — proceed anyway */ }
      activate();
    }
  }

  return {
    init,
    activate,
    deactivate,
    toggle,
    get isActive() { return active; }
  };
})();
