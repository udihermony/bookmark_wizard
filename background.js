// Configuration for LM Studio
import { LMStudioClient } from './lmstudio-wrapper.js';

// Create a client instance
const client = new LMStudioClient({
  baseUrl: 'http://localhost:1234',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Function to get all bookmarks
async function getAllBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const bookmarks = [];
      
      function extractBookmarks(nodes) {
        for (const node of nodes) {
          if (node.url) {
            bookmarks.push({
              id: node.id,
              title: node.title,
              url: node.url,
              description: node.description || '',
              url: node.url,
              children: node.data
            });
          }
          if (node.children) {
            extractBookmarks(node.children);
          }
        }
      }
      
      extractBookmarks(bookmarkTreeNodes);
      resolve(bookmarks);
    });
  });
}

// Function to save bookmarks to storage
async function saveBookmarks(bookmarks) {
  try {
    await chrome.storage.local.set({ bookmarks });
    return true;
  } catch (error) {
    console.error('Error saving bookmarks:', error);
    throw error;
  }
}

// Function to get all saved bookmarks
async function getSavedBookmarks() {
  try {
    const result = await chrome.storage.local.get('bookmarks');
    return result.bookmarks || [];
  } catch (error) {
    console.error('Error retrieving bookmarks:', error);
    throw error;
  }
}

// Function to get a specific bookmark by ID
async function getBookmarkById(id) {
  try {
    const bookmarks = await getSavedBookmarks();
    return bookmarks.find(bookmark => bookmark.id === id) || null;
  } catch (error) {
    console.error('Error retrieving bookmark:', error);
    throw error;
  }
}

// Function to analyze a bookmark
async function analyzeBookmark(bookmark) {
  try {
    // For now, just return the bookmark as is
    const analysis = {
      bookmarkId: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description || '',
      timestamp: new Date().toISOString()
    };
    
    // Save the analysis to chrome.storage
    const bookmarks = await getSavedBookmarks();
    const updatedBookmarks = bookmarks.map(b => 
      b.id === bookmark.id ? { ...b, ...analysis } : b
    );
    await saveBookmarks(updatedBookmarks);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing bookmark:', error);
    throw error;
  }
}

// Function to inspect storage
async function inspectStorage() {
  try {
    const allData = await chrome.storage.local.get(null);
    console.log('All data in chrome.storage.local:', allData);
    return allData;
  } catch (error) {
    console.error('Error inspecting storage:', error);
    throw error;
  }
}

// Function to analyze bookmarks with LLM
async function analyzeBookmarksWithLLM(titles) {
  try {
    const messages = [
      {
        role: "system",
        content: "You are a helpful assistant that categorizes bookmarks. Given a list of bookmark titles, suggest categories for them."
      },
      {
        role: "user",
        content: `Please analyze these bookmark titles and suggest categories for them:
          ${titles.join('\n')}`
      }
    ];

    const llm = await client.llm.model();
    const response = await llm.respond(messages, {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bookmark_analysis",
          strict: "true",
          schema: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    explanation: { type: "string" }
                  },
                  required: ["title", "category", "explanation"]
                }
              }
            },
            required: ["categories"]
          }
        }
      },
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    });
    
    return response;
  } catch (error) {
    console.error('Error analyzing bookmarks:', error);
    throw error;
  }
}

// Function to categorize a single bookmark
async function categorizeBookmark(bookmark, categories) {
  try {
    const prompt = `Given the following bookmark:
Title: ${bookmark.title}
URL: ${bookmark.url}

Current categories: ${categories.join(', ')}

IMPORTANT: if this bookmark fits in one of the current categories Create a new one.

For example:
- For a cost tracking page: "Cost Management" or "Usage Tracking"
- For a documentation page: "Documentation" or "Technical Reference"
- For a learning resource: "Learning Resources" or "Educational Content"

Return a JSON object with the following format:
{
  "category": "new or existing category name",
  "explanation": "brief explanation of why this category was chosen"
}`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that categorizes bookmarks. You MUST create new, specific categories. NEVER use "Other" or generic categories. Be descriptive and precise with category names.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content.trim();
    console.log('Raw LLM response:', responseText);
    
    try {
      // Clean the response text by removing any trailing newlines and whitespace
      const cleanResponse = responseText.replace(/\n/g, '').trim();
      const parsedResponse = JSON.parse(cleanResponse);
      console.log('Parsed response:', parsedResponse);
      
      if (!parsedResponse.category) {
        throw new Error('Response missing category field');
      }
      
      // If the LLM still returns "Other", force it to create a new category
      if (parsedResponse.category.toLowerCase() === 'other') {
        const newCategory = `Resource Management`; // Default category for cost/usage tracking
        console.log('Forcing new category instead of "Other":', newCategory);
        return { success: true, category: newCategory };
      }
      
      return { success: true, category: parsedResponse.category };
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      // If parsing fails, try to extract just the category name
      const categoryMatch = responseText.match(/"category"\s*:\s*"([^"]+)"/);
      if (categoryMatch) {
        const category = categoryMatch[1];
        // If the extracted category is "Other", force a new category
        if (category.toLowerCase() === 'other') {
          return { success: true, category: 'Resource Management' };
        }
        return { success: true, category };
      }
      throw new Error('Invalid response format from LLM');
    }
  } catch (error) {
    console.error('Error categorizing bookmark:', error);
    return { success: false, error: error.message };
  }
}

// Function to consolidate categories
async function consolidateCategories(categories) {
  try {
    const prompt = `Given the following list of categories:
${categories.join('\n')}

Please consolidate these categories into exactly 5 categories. 
- Combine similar categories into broader, more general categories
- Choose the 5 most important and widely applicable categories
- Ensure the consolidated categories are clear and meaningful
- Make sure each category can accommodate multiple types of content

Return a JSON object with the following format:
{
  "categories": ["category1", "category2", "category3", "category4", "category5"]
}`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that consolidates bookmark categories. You must return exactly 5 categories. Return a JSON object with a "categories" array containing exactly 5 category names.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content.trim();
    console.log('Raw consolidation response:', responseText);
    
    try {
      // Clean the response text by removing any trailing newlines and whitespace
      const cleanResponse = responseText.replace(/\n/g, '').trim();
      const parsedResponse = JSON.parse(cleanResponse);
      console.log('Parsed consolidation response:', parsedResponse);
      
      if (!parsedResponse.categories || !Array.isArray(parsedResponse.categories)) {
        throw new Error('Response missing categories array');
      }
      
      if (parsedResponse.categories.length !== 5) {
        throw new Error(`Expected exactly 5 categories, got ${parsedResponse.categories.length}`);
      }
      
      return { success: true, categories: parsedResponse.categories };
    } catch (parseError) {
      console.error('Error parsing consolidation response:', parseError);
      throw new Error('Invalid response format from LLM');
    }
  } catch (error) {
    console.error('Error consolidating categories:', error);
    return { success: false, error: error.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (!request || !request.action) {
    console.error('Invalid message received:', request);
    sendResponse({ success: false, error: 'Invalid message format' });
    return true;
  }

  if (request.action === 'analyzeBookmark') {
    getAllBookmarks()
      .then(bookmarks => {
        if (!bookmarks || bookmarks.length === 0) {
          throw new Error('No bookmarks found');
        }
        // For now, analyze the first bookmark
        return analyzeBookmark(bookmarks[0]);
      })
      .then(analysis => {
        console.log('Bookmark analyzed:', analysis);
        sendResponse({ success: true, analysis });
      })
      .catch(error => {
        console.error('Error in analyzeBookmark:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getAllBookmarks') {
    getAllBookmarks()
      .then(bookmarks => saveBookmarks(bookmarks))
      .then(() => {
        console.log('Successfully saved all bookmarks');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error in getAllBookmarks:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
  
  if (request.action === 'getSavedBookmarks') {
    getSavedBookmarks()
      .then(bookmarks => {
        console.log('Retrieved bookmarks:', bookmarks);
        sendResponse({ success: true, bookmarks });
      })
      .catch(error => {
        console.error('Error in getSavedBookmarks:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'getBookmarkById') {
    if (!request.id) {
      console.error('No ID provided for getBookmarkById');
      sendResponse({ success: false, error: 'No bookmark ID provided' });
      return true;
    }

    getBookmarkById(request.id)
      .then(bookmark => {
        console.log('Retrieved bookmark:', bookmark);
        sendResponse({ success: true, bookmark });
      })
      .catch(error => {
        console.error('Error in getBookmarkById:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'inspectStorage') {
    inspectStorage()
      .then(data => {
        console.log('Storage contents:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Error inspecting storage:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'analyzeBookmarks') {
    if (!request.titles || !Array.isArray(request.titles)) {
      sendResponse({ success: false, error: 'No titles provided' });
      return true;
    }

    analyzeBookmarksWithLLM(request.titles)
      .then(analysis => {
        console.log('Bookmarks analyzed:', analysis);
        sendResponse({ success: true, analysis });
      })
      .catch(error => {
        console.error('Error in analyzeBookmarks:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'categorizeBookmark') {
    categorizeBookmark(request.bookmark, request.categories)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'consolidateCategories') {
    consolidateCategories(request.categories)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle unknown actions
  console.error('Unknown action:', request.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});