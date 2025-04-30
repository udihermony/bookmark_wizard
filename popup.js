document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const organizeBtn = document.getElementById('organizeBtn');
  const loading = document.getElementById('loading');
  const status = document.getElementById('status');

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = 'status ' + (isError ? 'error' : 'success');
    status.style.display = 'block';
  }

  function setLoading(isLoading) {
    loading.style.display = isLoading ? 'block' : 'none';
    analyzeBtn.disabled = isLoading;
    organizeBtn.disabled = isLoading;
  }

  analyzeBtn.addEventListener('click', async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({ action: 'analyzeBookmarks' });
      if (response.success) {
        showStatus('Bookmarks analyzed successfully!');
        organizeBtn.disabled = false;
      } else {
        showStatus('Error analyzing bookmarks: ' + response.error, true);
      }
    } catch (error) {
      showStatus('Error: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  });

  organizeBtn.addEventListener('click', async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({ action: 'organizeBookmarks' });
      if (response.success) {
        showStatus('Bookmarks organized successfully!');
      } else {
        showStatus('Error organizing bookmarks: ' + response.error, true);
      }
    } catch (error) {
      showStatus('Error: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  });
}); 