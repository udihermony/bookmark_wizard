// Configuration for the LLM API
const LLM_API_KEY = 'AIzaSyAd95HuZprHOg60u0p7EE-v0iMtMaFERAQ'; // You'll need to add your Gemini API key here
const LLM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Function to show debug popup
function showDebugPopup(title, content) {
  const popupWidth = 800;
  const popupHeight = 600;
  const left = (screen.width - popupWidth) / 2;
  const top = (screen.height - popupHeight) / 2;

  const debugWindow = window.open(
    '',
    'debugWindow',
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
  );

  debugWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Debug: ${title}</title>
        <style>
          body {
            font-family: monospace;
            padding: 20px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .section {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <div class="section">
          ${content}
        </div>
      </body>
    </html>
  `);
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
    
    debugOutput += '=== Final cleaned text ===\n';
    debugOutput += cleanText + '\n\n';
    
    // Try to parse the JSON
    try {
      const parsed = JSON.parse(cleanText);
      debugOutput += '=== Successfully parsed JSON ===\n';
      debugOutput += JSON.stringify(parsed, null, 2);
      showDebugPopup('JSON Cleaning Process', debugOutput);
      return parsed;
    } catch (parseError) {
      // If parsing fails, try to find the exact position of the error
      const errorPosition = parseInt(parseError.message.match(/\d+/)[0]);
      debugOutput += '=== JSON Parse Error Details ===\n';
      debugOutput += 'Error position: ' + errorPosition + '\n';
      debugOutput += 'Text before error: ' + cleanText.substring(Math.max(0, errorPosition - 50), errorPosition) + '\n';
      debugOutput += 'Text after error: ' + cleanText.substring(errorPosition, Math.min(cleanText.length, errorPosition + 50)) + '\n';
      debugOutput += 'Full cleaned text: ' + cleanText + '\n';
      showDebugPopup('JSON Parsing Error', debugOutput);
      throw parseError;
    }
  } catch (error) {
    debugOutput += '=== Error cleaning JSON ===\n';
    debugOutput += 'Error: ' + error + '\n';
    debugOutput += 'Original text: ' + text + '\n';
    showDebugPopup('JSON Cleaning Error', debugOutput);
    throw new Error('Failed to parse JSON response: ' + error.message);
  }
}

// Function to analyze bookmarks using Gemini
async function analyzeBookmarks(bookmarks) {
  const prompt = `You are a JSON-only response bot. You must respond with valid JSON only, no markdown, no backticks, no additional text. All property names must be double-quoted.

    Analyze these bookmarks and suggest categories for them.
    For each bookmark, provide a category and a brief explanation.
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
    ${JSON.stringify(bookmarks, null, 2)}`;

  try {
    console.log('Sending request to Gemini...');
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    showDebugPopup('API Request', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${LLM_API_ENDPOINT}?key=${LLM_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (data.error) {
      showDebugPopup('API Error', JSON.stringify(data.error, null, 2));
      throw new Error(data.error.message);
    }
    
    showDebugPopup('API Response', JSON.stringify(data, null, 2));
    
    const responseText = data.candidates[0].content.parts[0].text;
    return cleanAndParseJSON(responseText);
  } catch (error) {
    console.error('Error analyzing bookmarks:', error);
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
        await chrome.bookmarks.move(bookmark.id, {
          parentId: folder.id
        });
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
      .then(bookmarks => analyzeBookmarks(bookmarks))
      .then(analysis => {
        chrome.storage.local.set({ bookmarkAnalysis: analysis }, () => {
          sendResponse({ success: true });
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