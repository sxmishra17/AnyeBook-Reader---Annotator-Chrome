// Background service worker for eBook Annotator (Chrome MV3)
// Handles tab capture for snapshot functionality.
// Note: Downloads are handled directly by FileSaver.js in the reader page.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'captureTab') {
    // captureVisibleTab screenshots the active tab in the given window.
    // Using sender.tab.windowId ensures we target the reader's own window.
    const windowId = sender?.tab?.windowId ?? null;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('captureVisibleTab failed:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});
