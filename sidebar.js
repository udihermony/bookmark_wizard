// Function to get favicon URL
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=16`;
  } catch (e) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAB2AAAAdgB+lymcgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB8SURBVDiNY2AYBYMRMDIyMjAyMjL8//+f4f///wz//v1j+P//P8P///8Z/v//z/Dv3z+Gf//+Mfz9+5fh79+/DH/+/GH4/fs3w69fvxh+/vzJ8OPHD4bv378zfPv2jeHr168MX758Yfj8+TPDp0+fGD5+/Mjw4cMHhvfv3zO8e/eO4e3btwwAANn3LQZqXhQAAAAASUVORK5CYII=';
  }
}

// Function to create bookmark element
function createBookmarkElement(bookmark) {
  const div = document.createElement('div');
  div.className = 'bookmark-item';
  
  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = getFaviconUrl(bookmark.url);
  favicon.onerror = () => {
    favicon.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAB2AAAAdgB+lymcgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAB8SURBVDiNY2AYBYMRMDIyMjAyMjL8//+f4f///wz//v1j+P//P8P///8Z/v//z/Dv3z+Gf//+Mfz9+5fh79+/DH/+/GH4/fs3w69fvxh+/vzJ8OPHD4bv378zfPv2jeHr168MX758Yfj8+TPDp0+fGD5+/Mjw4cMHhvfv3zO8e/eO4e3btwwAANn3LQZqXhQAAAAASUVORK5CYII=';
  };
  
  const title = document.createElement('a');
  title.className = 'bookmark-title';
  title.textContent = bookmark.title;
  title.href = bookmark.url;
  title.target = '_blank';
  title.title = bookmark.url; // Show URL on hover
  
  div.appendChild(favicon);
  div.appendChild(title);
  
  return div;
}

// Function to create category folder element
function createCategoryFolder(category) {
  const div = document.createElement('div');
  div.className = 'category-folder';
  
  const header = document.createElement('div');
  header.className = 'category-folder-header';
  
  const folderIcon = document.createElement('div');
  folderIcon.className = 'folder-icon';
  folderIcon.innerHTML = '&#128193;'; // Using HTML entity for folder icon
  
  const categoryName = document.createElement('div');
  categoryName.className = 'category-name';
  categoryName.textContent = typeof category === 'string' ? category : category.name;
  
  header.appendChild(folderIcon);
  header.appendChild(categoryName);
  
  div.appendChild(header);
  
  return div;
}

// Function to update categories display
function updateCategoriesDisplay(categories, categoriesColumn) {
  console.log('Updating categories display with:', categories);
  
  // Remove all existing category folders (keep only the header)
  while (categoriesColumn.children.length > 1) {
    categoriesColumn.removeChild(categoriesColumn.lastChild);
  }
  
  // Add updated categories
  categories.forEach(category => {
    const folder = createCategoryFolder(category);
    categoriesColumn.appendChild(folder);
  });
  
  // Force a reflow to ensure the display updates
  categoriesColumn.style.display = 'none';
  categoriesColumn.offsetHeight; // Force reflow
  categoriesColumn.style.display = 'block';
}

// Function to save categorized bookmarks
function saveCategorizedBookmarks(categories, bookmarks) {
  const data = {
    categories: categories,
    bookmarks: bookmarks,
    lastUpdated: new Date().toISOString()
  };
  
  chrome.storage.local.set({ 'categorizedBookmarks': data }, () => {
    console.log('Saved categorized bookmarks:', data);
  });
}

// Function to load categorized bookmarks
function loadCategorizedBookmarks(onComplete) {
  chrome.storage.local.get(['categorizedBookmarks'], (result) => {
    if (result.categorizedBookmarks) {
      console.log('Loaded categorized bookmarks:', result.categorizedBookmarks);
      onComplete(result.categorizedBookmarks);
    } else {
      console.log('No saved categorized bookmarks found');
      onComplete(null);
    }
  });
}

// Function to process a single bookmark with retries
function processBookmark(bookmark, categories, categoriesColumn, bookmarks, onComplete, retryCount = 0) {
  console.log('Processing bookmark:', bookmark.title, 'Retry:', retryCount);
  
  // Send to background script for categorization
  chrome.runtime.sendMessage({ 
    action: 'categorizeBookmark', 
    bookmark: bookmark,
    categories: categories
  }, response => {
    if (response.success) {
      console.log('Received categorization:', response.category);
      
      let newCategory = response.category;
      if (typeof newCategory === 'string') {
        // Check if this is a new category
        const isNewCategory = !categories.some(c => 
          (typeof c === 'string' ? c : c.name).toLowerCase() === newCategory.toLowerCase()
        );
        
        if (isNewCategory) {
          console.log('Adding new category:', newCategory);
          categories.push(newCategory);
          updateCategoriesDisplay(categories, categoriesColumn);
        }
        
        // Add category to the bookmark
        const bookmarkIndex = bookmarks.findIndex(b => b.url === bookmark.url);
        if (bookmarkIndex !== -1) {
          bookmarks[bookmarkIndex].category = newCategory;
          console.log('Updated bookmark category:', bookmarks[bookmarkIndex].title, '->', newCategory);
        }
        
        // Save the updated categories and bookmarks
        saveCategorizedBookmarks(categories, bookmarks);
      }
      
      // Continue with next bookmark
      onComplete();
    } else {
      console.error('Categorization failed:', response.error);
      if (retryCount < 5 && response.error.includes('parsing')) {
        console.log(`Retrying bookmark processing (attempt ${retryCount + 1})`);
        setTimeout(() => {
          processBookmark(bookmark, categories, categoriesColumn, bookmarks, onComplete, retryCount + 1);
        }, 1000);
      } else {
        // If all retries failed, assign to "Other"
        const bookmarkIndex = bookmarks.findIndex(b => b.url === bookmark.url);
        if (bookmarkIndex !== -1) {
          bookmarks[bookmarkIndex].category = "Other";
          console.log('Assigned to Other after failed categorization:', bookmarks[bookmarkIndex].title);
          saveCategorizedBookmarks(categories, bookmarks);
        }
        onComplete();
      }
    }
  });
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

// Function to consolidate categories with retries
function consolidateCategories(categories, onComplete, retryCount = 0) {
  console.log('Consolidating categories:', categories, 'Retry:', retryCount);
  
  chrome.runtime.sendMessage({ 
    action: 'consolidateCategories', 
    categories: categories
  }, response => {
    if (response.success) {
      console.log('Received consolidated categories:', response.categories);
      // Save the consolidated categories
      saveCategorizedBookmarks(response.categories, bookmarks);
      onComplete(response.categories);
    } else {
      console.error('Error consolidating categories:', response.error);
      if (retryCount < 5 && response.error.includes('parsing')) {
        console.log(`Retrying category consolidation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          consolidateCategories(categories, onComplete, retryCount + 1);
        }, 1000);
      } else {
        onComplete(categories);
      }
    }
  });
}

// Function to analyze bookmarks with LLM
function analyzeBookmarks() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  showStatus('Analyzing bookmarks...');
  
  // First try to load existing categorized bookmarks
  loadCategorizedBookmarks((savedData) => {
    if (savedData) {
      console.log('Found saved categorized bookmarks from:', savedData.lastUpdated);
    }
    
    chrome.runtime.sendMessage({ action: 'getSavedBookmarks' }, response => {
      if (!response.success) {
        showStatus('Error getting bookmarks: ' + response.error, true);
        analyzeBtn.disabled = false;
        return;
      }
      
      const bookmarks = response.bookmarks;
      if (!bookmarks || bookmarks.length === 0) {
        showStatus('No bookmarks to analyze', true);
        analyzeBtn.disabled = false;
        return;
      }
      
      // Limit to first 20 bookmarks
      const limitedBookmarks = bookmarks.slice(0, 20);
      console.log(`Processing ${limitedBookmarks.length} bookmarks (limited to first 20)`);
      
      // Create the sidebar layout
      const sidebar = document.createElement('div');
      sidebar.className = 'sidebar-layout';
      
      // Create the categories column
      const categoriesColumn = document.createElement('div');
      categoriesColumn.className = 'categories-column';
      const categoriesHeader = document.createElement('h3');
      categoriesHeader.textContent = 'Categories';
      categoriesColumn.appendChild(categoriesHeader);
      
      // Create the bookmarks column
      const bookmarksColumn = document.createElement('div');
      bookmarksColumn.className = 'bookmarks-column';
      const bookmarksHeader = document.createElement('h3');
      bookmarksHeader.textContent = 'Bookmarks';
      bookmarksColumn.appendChild(bookmarksHeader);
      
      // Add columns to sidebar
      sidebar.appendChild(categoriesColumn);
      sidebar.appendChild(bookmarksColumn);
      
      // Update the bookmark list
      const bookmarkList = document.getElementById('bookmarkList');
      bookmarkList.innerHTML = '';
      bookmarkList.appendChild(sidebar);
      
      // Initialize categories array with "Other" or use saved categories
      let categories = savedData ? savedData.categories : ["Other"];
      updateCategoriesDisplay(categories, categoriesColumn);
      
      // Process bookmarks one by one
      let currentIndex = 0;
      
      function processNextBookmark() {
        if (currentIndex < limitedBookmarks.length) {
          const bookmark = limitedBookmarks[currentIndex];
          
          // Check if we need to consolidate categories (when count exceeds 20)
          if (categories.length > 20) {
            console.log('Category count exceeds 20. Current count:', categories.length);
            showStatus('Consolidating categories...');
            consolidateCategories(categories, (newCategories) => {
              console.log('Categories before consolidation:', categories);
              console.log('Categories after consolidation:', newCategories);
              categories = newCategories;
              updateCategoriesDisplay(categories, categoriesColumn);
              // Continue with current bookmark after consolidation
              processCurrentBookmark();
            });
          } else {
            processCurrentBookmark();
          }
        } else {
          // All bookmarks processed
          showStatus('Analysis complete!');
          analyzeBtn.disabled = false;
        }
      }
      
      function processCurrentBookmark() {
        const bookmark = limitedBookmarks[currentIndex];
        currentIndex++;
        
        // Update status
        showStatus(`Processing bookmark ${currentIndex} of ${limitedBookmarks.length}...`);
        
        // Process the current bookmark
        processBookmark(bookmark, categories, categoriesColumn, limitedBookmarks, () => {
          // Add bookmark to the display
          const bookmarkElement = document.createElement('div');
          bookmarkElement.className = 'bookmark-item';
          bookmarkElement.textContent = bookmark.title;
          bookmarksColumn.appendChild(bookmarkElement);
          
          // Process next bookmark
          processNextBookmark();
        });
      }
      
      // Start processing
      processNextBookmark();
    });
  });
}

// Function to display library view
function displayLibrary() {
  const bookmarkList = document.getElementById('bookmarkList');
  bookmarkList.innerHTML = '';
  
  // Create library container
  const libraryContainer = document.createElement('div');
  libraryContainer.className = 'library-container';
  
  // Create header with last updated time
  const header = document.createElement('div');
  header.className = 'library-header';
  
  loadCategorizedBookmarks((savedData) => {
    if (savedData) {
      const lastUpdated = new Date(savedData.lastUpdated).toLocaleString();
      header.innerHTML = `
        <h2>Bookmark Library</h2>
        <div class="last-updated">Last updated: ${lastUpdated}</div>
      `;
      
      // Create categories section
      const categoriesSection = document.createElement('div');
      categoriesSection.className = 'library-categories';
      
      // Sort categories to ensure "Other" is last
      const sortedCategories = [...savedData.categories].sort((a, b) => {
        const aName = typeof a === 'string' ? a : a.name;
        const bName = typeof b === 'string' ? b : b.name;
        if (aName === "Other") return 1;
        if (bName === "Other") return -1;
        return aName.localeCompare(bName);
      });
      
      sortedCategories.forEach(category => {
        const categoryFolder = document.createElement('div');
        categoryFolder.className = 'library-category';
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'library-category-header';
        folderHeader.innerHTML = `
          <div class="folder-icon">&#128193;</div>
          <div class="category-name">${typeof category === 'string' ? category : category.name}</div>
        `;
        
        const bookmarksList = document.createElement('div');
        bookmarksList.className = 'library-bookmarks';
        
        // Filter bookmarks for this category
        const categoryBookmarks = savedData.bookmarks.filter(bookmark => {
          const bookmarkCategory = bookmark.category || 'Other';
          return bookmarkCategory.toLowerCase() === (typeof category === 'string' ? category : category.name).toLowerCase();
        });
        
        console.log(`Category ${category}: ${categoryBookmarks.length} bookmarks`);
        
        categoryBookmarks.forEach(bookmark => {
          const bookmarkElement = createBookmarkElement(bookmark);
          bookmarkElement.className = 'library-bookmark';
          bookmarksList.appendChild(bookmarkElement);
        });
        
        // Add click handler to toggle bookmarks visibility
        folderHeader.addEventListener('click', () => {
          bookmarksList.style.display = bookmarksList.style.display === 'none' ? 'block' : 'none';
          folderHeader.classList.toggle('expanded');
        });
        
        categoryFolder.appendChild(folderHeader);
        categoryFolder.appendChild(bookmarksList);
        categoriesSection.appendChild(categoryFolder);
      });
      
      libraryContainer.appendChild(header);
      libraryContainer.appendChild(categoriesSection);
      bookmarkList.appendChild(libraryContainer);
    } else {
      bookmarkList.innerHTML = '<div class="no-library">No categorized bookmarks found. Please analyze your bookmarks first.</div>';
    }
  });
}

// Function to show debug information
function showDebugInfo() {
  chrome.storage.local.get(null, (data) => {
    console.log('All stored data:', data);
    
    // Create debug view
    const debugContainer = document.createElement('div');
    debugContainer.className = 'debug-container';
    
    const header = document.createElement('h3');
    header.textContent = 'Debug Information';
    debugContainer.appendChild(header);
    
    // Show categorized bookmarks
    if (data.categorizedBookmarks) {
      const categoriesSection = document.createElement('div');
      categoriesSection.innerHTML = `
        <h4>Categories (${data.categorizedBookmarks.categories.length})</h4>
        <pre>${JSON.stringify(data.categorizedBookmarks.categories, null, 2)}</pre>
        
        <h4>Bookmarks by Category</h4>
      `;
      
      // Group bookmarks by category
      const bookmarksByCategory = {};
      data.categorizedBookmarks.bookmarks.forEach(bookmark => {
        const category = bookmark.category || 'Other';
        if (!bookmarksByCategory[category]) {
          bookmarksByCategory[category] = [];
        }
        bookmarksByCategory[category].push(bookmark);
      });
      
      // Display bookmarks for each category
      Object.entries(bookmarksByCategory).forEach(([category, bookmarks]) => {
        const categorySection = document.createElement('div');
        categorySection.innerHTML = `
          <h5>${category} (${bookmarks.length} bookmarks)</h5>
          <pre>${JSON.stringify(bookmarks.map(b => ({ title: b.title, url: b.url })), null, 2)}</pre>
        `;
        categoriesSection.appendChild(categorySection);
      });
      
      debugContainer.appendChild(categoriesSection);
    }
    
    // Show last updated time
    if (data.categorizedBookmarks?.lastUpdated) {
      const lastUpdated = new Date(data.categorizedBookmarks.lastUpdated).toLocaleString();
      const timeSection = document.createElement('div');
      timeSection.innerHTML = `<p>Last Updated: ${lastUpdated}</p>`;
      debugContainer.appendChild(timeSection);
    }
    
    // Add to the page
    const bookmarkList = document.getElementById('bookmarkList');
    bookmarkList.innerHTML = '';
    bookmarkList.appendChild(debugContainer);
  });
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load bookmarks when sidebar opens
  loadBookmarks();
  
  // Add refresh button handler
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadBookmarks();
  });
  
  // Add fetch button handler
  document.getElementById('fetchBtn').addEventListener('click', () => {
    fetchBookmarks();
  });
  
  // Add analyze button handler
  document.getElementById('analyzeBtn').addEventListener('click', () => {
    analyzeBookmarks();
  });
  
  // Add show library button handler
  document.getElementById('showLibraryBtn').addEventListener('click', () => {
    displayLibrary();
  });
  
  // Add debug button handler
  document.getElementById('debugBtn').addEventListener('click', () => {
    showDebugInfo();
  });
}); 