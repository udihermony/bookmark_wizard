document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const organizeBtn = document.getElementById('organizeBtn');
  const statusDiv = document.getElementById('status');
  const debugSection = document.getElementById('debugSection');
  const debugTitle = document.querySelector('.debug-title');
  const debugContent = document.getElementById('debugContent');

  // Listen for debug messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showDebug') {
      debugTitle.textContent = message.title;
      debugContent.textContent = message.content;
      debugSection.style.display = 'block';
    }
  });

  analyzeBtn.addEventListener('click', async () => {
    try {
      analyzeBtn.disabled = true;
      organizeBtn.disabled = true;
      statusDiv.className = '';
      statusDiv.textContent = 'Analyzing bookmarks...';
      debugSection.style.display = 'none';

      await chrome.runtime.sendMessage({ action: 'analyzeBookmarks' });
      
      statusDiv.className = 'success';
      statusDiv.textContent = 'Analysis complete! You can now organize your bookmarks.';
      organizeBtn.disabled = false;
    } catch (error) {
      statusDiv.className = 'error';
      statusDiv.textContent = 'Error: ' + error.message;
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  organizeBtn.addEventListener('click', async () => {
    try {
      analyzeBtn.disabled = true;
      organizeBtn.disabled = true;
      statusDiv.className = '';
      statusDiv.textContent = 'Organizing bookmarks...';
      debugSection.style.display = 'none';

      await chrome.runtime.sendMessage({ action: 'organizeBookmarks' });
      
      statusDiv.className = 'success';
      statusDiv.textContent = 'Bookmarks organized successfully!';
    } catch (error) {
      statusDiv.className = 'error';
      statusDiv.textContent = 'Error: ' + error.message;
    } finally {
      analyzeBtn.disabled = false;
      organizeBtn.disabled = true;
    }
  });
}); 