// Configuration for the LLM API
const OLLAMA_API_ENDPOINT = 'http://localhost:11434/api/generate';

// Function to send debug info to popup
async function sendDebugInfo(title, content) {
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  if (tabs.length > 0) {
    chrome.runtime.sendMessage({
      action: 'showDebug',
      title: title,
      content: content
    });
  }
}

// Function to make API request with timeout
async function fetchWithTimeout(url, options, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after ' + timeout + 'ms');
    }
    throw error;
  }
}

// Function to get all bookmarks
async function getAllBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const bookmarks = [];
      function traverseBookmarks(nodes) {
        for (const node of nodes) {
          if (node.url) {
            bookmarks.push({
              id: node.id,
              title: node.title,
              url: node.url
            });
          }
          if (node.children) {
            traverseBookmarks(node.children);
          }
        }
      }
      traverseBookmarks(bookmarkTreeNodes);
      resolve(bookmarks);
    });
  });
}

// Function to process bookmarks in batches
async function processBookmarksInBatches(bookmarks, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    batches.push(bookmarks.slice(i, i + batchSize));
  }
  return batches;
}

// Function to clean and parse JSON response
function cleanAndParseJSON(text) {
  let debugOutput = '';
  debugOutput += '=== Original Response ===\n';
  debugOutput += text + '\n\n';
  
  try {
    // Remove any markdown formatting
    let cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
    debugOutput += '=== After removing markdown ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Find the first { and last } to extract just the JSON object
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}') + 1;
    if (startIndex === -1 || endIndex === 0) {
      throw new Error('No valid JSON object found in response');
    }
    cleanText = cleanText.slice(startIndex, endIndex);
    debugOutput += '=== After extracting JSON object ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Handle apostrophes in text by escaping them
    cleanText = cleanText.replace(/([^\\])'([^']*)'/g, '$1\\"$2\\"');
    cleanText = cleanText.replace(/^'([^']*)'/g, '"\\"$1\\""');
    debugOutput += '=== After handling apostrophes ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Ensure all property names are double-quoted
    cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    debugOutput += '=== After ensuring double-quoted properties ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Remove any extra spaces and normalize newlines
    cleanText = cleanText
      .replace(/\n\s*/g, ' ')  // Replace newlines and their surrounding whitespace with a single space
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .replace(/\s*([{}[\],:])\s*/g, '$1'); // Remove spaces around JSON syntax characters
    
    // Fix incomplete JSON by adding missing closing brackets/braces
    const openBraces = (cleanText.match(/{/g) || []).length;
    const closeBraces = (cleanText.match(/}/g) || []).length;
    const openBrackets = (cleanText.match(/\[/g) || []).length;
    const closeBrackets = (cleanText.match(/\]/g) || []).length;
    
    // Add missing closing brackets/braces
    cleanText += '}'.repeat(openBraces - closeBraces);
    cleanText += ']'.repeat(openBrackets - closeBrackets);
    
    debugOutput += '=== Final cleaned text ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Try to parse the JSON
    try {
      const parsed = JSON.parse(cleanText);
      debugOutput += '=== Successfully parsed JSON ===\n';
      debugOutput += JSON.stringify(parsed, null, 2);
      sendDebugInfo('JSON Cleaning Process', debugOutput);
      return parsed;
    } catch (parseError) {
      // If parsing fails, try to find the exact position of the error
      const errorPosition = parseInt(parseError.message.match(/\d+/)[0]);
      debugOutput += '=== JSON Parse Error Details ===\n';
      debugOutput += 'Error position: ' + errorPosition + '\n';
      debugOutput += 'Text before error: ' + cleanText.substring(Math.max(0, errorPosition - 50), errorPosition) + '\n';
      debugOutput += 'Text after error: ' + cleanText.substring(errorPosition, Math.min(cleanText.length, errorPosition + 50)) + '\n';
      debugOutput += 'Full cleaned text: ' + cleanText + '\n';
      sendDebugInfo('JSON Parsing Error', debugOutput);
      throw parseError;
    }
  } catch (error) {
    debugOutput += '=== Error cleaning JSON ===\n';
    debugOutput += 'Error: ' + error + '\n';
    debugOutput += 'Original text: ' + text + '\n';
    sendDebugInfo('JSON Cleaning Error', debugOutput);
    throw new Error('Failed to parse JSON response: ' + error.message);
  }
}

// Function to analyze bookmarks using Ollama
async function analyzeBookmarks(bookmarks) {
  // Create a simplified version with just titles and IDs
  const simplifiedBookmarks = bookmarks.map(b => ({
    id: b.id,
    title: b.title
  }));

  const prompt = `You are a JSON-only response bot. You must respond with valid JSON only, no markdown, no backticks, no additional text. All property names must be double-quoted.

    Analyze these bookmark titles and suggest categories for them.
    For each bookmark, provide a category and a brief explanation based on its title.
    IMPORTANT: You must respond with a valid JSON object only. No markdown, no backticks, no additional text.
    The response must be a single JSON object with this exact structure:
    {
      "categories": [
        {
          "name": "category_name",
          "bookmarks": [
            {
              "id": "bookmark_id",
              "category": "category_name",
              "explanation": "brief explanation"
            }
          ]
        }
      ]
    }
    
    Bookmarks to analyze:
    ${JSON.stringify(simplifiedBookmarks, null, 2)}`;

  try {
    console.log('Sending request to Ollama...');
    const requestBody = {
      model: "qwen3:32b",
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_k: 40,
        top_p: 0.95,
        num_predict: 2048
      }
    };

    sendDebugInfo('API Request', JSON.stringify(requestBody, null, 2));

    const response = await fetchWithTimeout(OLLAMA_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 30000); // 30 second timeout

    if (!response.ok) {
      const errorText = await response.text();
      sendDebugInfo('API Error Response', `Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      sendDebugInfo('API Error', JSON.stringify(data.error, null, 2));
      throw new Error(data.error);
    }
    
    sendDebugInfo('API Response', JSON.stringify(data, null, 2));
    
    const responseText = data.response;
    return cleanAndParseJSON(responseText);
  } catch (error) {
    console.error('Error analyzing bookmarks:', error);
    sendDebugInfo('Error Details', error.toString());
    throw error;
  }
}

// Function to organize bookmarks based on analysis
async function organizeBookmarks(analysis) {
  try {
    for (const category of analysis.categories) {
      // Create category folder if it doesn't exist
      const folder = await chrome.bookmarks.create({
        title: category.name,
        parentId: '1' // Root bookmark folder
      });

      // Move bookmarks to their respective folders
      for (const bookmark of category.bookmarks) {
        try {
          await chrome.bookmarks.move(bookmark.id, {
            parentId: folder.id
          });
        } catch (moveError) {
          console.error(`Error moving bookmark ${bookmark.id}:`, moveError);
          // Continue with next bookmark even if one fails
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Error organizing bookmarks:', error);
    throw error;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeBookmarks') {
    getAllBookmarks()
      .then(async (bookmarks) => {
        const batches = await processBookmarksInBatches(bookmarks);
        const allAnalysis = { categories: [] };
        
        for (let i = 0; i < batches.length; i++) {
          const batchAnalysis = await analyzeBookmarks(batches[i]);
          // Merge categories
          for (const category of batchAnalysis.categories) {
            const existingCategory = allAnalysis.categories.find(c => c.name === category.name);
            if (existingCategory) {
              existingCategory.bookmarks.push(...category.bookmarks);
            } else {
              allAnalysis.categories.push(category);
            }
          }
        }
        
        chrome.storage.local.set({ bookmarkAnalysis: allAnalysis }, () => {
          sendResponse({ success: true, totalBatches: batches.length });
        });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }

  if (request.action === 'organizeBookmarks') {
    chrome.storage.local.get(['bookmarkAnalysis'], async (result) => {
      try {
        if (!result.bookmarkAnalysis) {
          throw new Error('No bookmark analysis found');
        }
        await organizeBookmarks(result.bookmarkAnalysis);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Required for async response
  }
});