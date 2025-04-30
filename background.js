// Configuration for the LLM API
const LLM_API_KEY = 'AIzaSyAd95HuZprHOg60u0p7EE-v0iMtMaFERAQ'; // You'll need to add your Gemini API key here
const LLM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
  try {
    // Remove any markdown formatting
    let cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
    
    // Find the first { and last } to extract just the JSON object
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}') + 1;
    if (startIndex === -1 || endIndex === 0) {
      throw new Error('No valid JSON object found in response');
    }
    cleanText = cleanText.slice(startIndex, endIndex);
    
    // Replace any single quotes with double quotes
    cleanText = cleanText.replace(/'/g, '"');
    
    // Ensure all property names are double-quoted
    cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    
    // Remove any extra spaces and normalize newlines
    cleanText = cleanText
      .replace(/\n\s*/g, ' ')  // Replace newlines and their surrounding whitespace with a single space
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .replace(/\s*([{}[\],:])\s*/g, '$1'); // Remove spaces around JSON syntax characters
    
    // Try to parse the JSON
    try {
      return JSON.parse(cleanText);
    } catch (parseError) {
      // If parsing fails, try to find the exact position of the error
      const errorPosition = parseInt(parseError.message.match(/\d+/)[0]);
      console.error('JSON Parse Error Details:');
      console.error('Error position:', errorPosition);
      console.error('Text before error:', cleanText.substring(Math.max(0, errorPosition - 50), errorPosition));
      console.error('Text after error:', cleanText.substring(errorPosition, Math.min(cleanText.length, errorPosition + 50)));
      console.error('Full cleaned text:', cleanText);
      throw parseError;
    }
  } catch (error) {
    console.error('Error cleaning JSON:', error);
    console.error('Original text:', text);
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
    const response = await fetch(`${LLM_API_ENDPOINT}?key=${LLM_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent output
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const responseText = data.candidates[0].content.parts[0].text;
    console.log('Raw response:', responseText);
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