document.getElementById('open-reader').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('reader/reader.html')
  });
  window.close();
});
