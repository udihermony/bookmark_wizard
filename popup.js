// Function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Function to create bookmark element
function createBookmarkElement(bookmark) {
  const div = document.createElement('div');
  div.className = 'bookmark-item';
  
  const id = document.createElement('div');
  id.className = 'bookmark-id';
  id.textContent = `ID: ${bookmark.id}`;
  
  const title = document.createElement('div');
  title.className = 'bookmark-title';
  title.textContent = bookmark.title;
  
  const url = document.createElement('a');
  url.className = 'bookmark-url';
  url.href = bookmark.url;
  url.textContent = bookmark.url;
  url.target = '_blank';
  
  div.appendChild(id);
  div.appendChild(title);
  div.appendChild(url);
  
  return div;
}

// Function to display bookmarks
function displayBookmarks(bookmarks) {
  const bookmarkList = document.getElementById('bookmarkList');
  bookmarkList.innerHTML = '';
  
  if (!bookmarks || bookmarks.length === 0) {
    bookmarkList.innerHTML = '<div class="no-bookmarks">No bookmarks found</div>';
    return;
  }
  
  bookmarks.forEach(bookmark => {
    bookmarkList.appendChild(createBookmarkElement(bookmark));
  });
}

// Function to show status message
function showStatus(message, isError = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

// Function to load bookmarks
function loadBookmarks() {
  chrome.runtime.sendMessage({ action: 'getSavedBookmarks' }, response => {
    if (response.success) {
      displayBookmarks(response.bookmarks);
    } else {
      document.getElementById('bookmarkList').innerHTML = 
        '<div class="no-bookmarks">Error loading bookmarks: ' + response.error + '</div>';
    }
  });
}

// Function to fetch bookmarks
function fetchBookmarks() {
  const fetchBtn = document.getElementById('fetchBtn');
  fetchBtn.disabled = true;
  showStatus('Fetching bookmarks...');
  
  chrome.runtime.sendMessage({ action: 'getAllBookmarks' }, response => {
    fetchBtn.disabled = false;
    if (response.success) {
      showStatus('Bookmarks fetched successfully!');
      loadBookmarks(); // Refresh the display
    } else {
      showStatus('Error fetching bookmarks: ' + response.error, true);
    }
  });
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load bookmarks when popup opens
  loadBookmarks();
  
  // Add refresh button handler
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadBookmarks();
  });
  
  // Add fetch button handler
  document.getElementById('fetchBtn').addEventListener('click', () => {
    fetchBookmarks();
  });
});