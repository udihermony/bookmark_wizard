// Configuration for the LLM API
const LLM_API_KEY = 'AIzaSyAd95HuZprHOg60u0p7EE-v0iMtMaFERAQ';
const LLM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Sample bookmarks for testing with special characters and edge cases
const testBookmarks = [
  {
    id: "1",
    title: "GitHub - Your Profile",
    url: "https://github.com/username"
  },
  {
    id: "2",
    title: "Stack Overflow: JavaScript [object Object] error",
    url: "https://stackoverflow.com/questions/123"
  },
  {
    id: "3",
    title: "Amazon.com: User's Shopping Cart & Wishlist",
    url: "https://amazon.com/cart"
  },
  {
    id: "4",
    title: "React.js - {useState} Hook Documentation",
    url: "https://reactjs.org/docs/hooks"
  },
  {
    id: "5",
    title: "YouTube - \"How to Code\" Tutorial",
    url: "https://youtube.com/watch?v=123"
  },
  {
    id: "6",
    title: "Gmail - Important & Starred",
    url: "https://mail.google.com/starred"
  },
  {
    id: "7",
    title: "MDN Web Docs: Array.prototype.map()",
    url: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map"
  },
  {
    id: "8",
    title: "Netflix: Continue Watching...",
    url: "https://netflix.com/watch"
  }
];

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
  console.log('\n=== Original Response ===');
  console.log(text);
  
  try {
    // Remove any markdown formatting
    let cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
    console.log('\n=== After removing markdown ===');
    console.log(cleanText);
    
    // Find the first { and last } to extract just the JSON object
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}') + 1;
    if (startIndex === -1 || endIndex === 0) {
      throw new Error('No valid JSON object found in response');
    }
    cleanText = cleanText.slice(startIndex, endIndex);
    console.log('\n=== After extracting JSON object ===');
    console.log(cleanText);
    
    // Handle apostrophes in text by escaping them
    cleanText = cleanText.replace(/([^\\])'([^']*)'/g, '$1\\"$2\\"');
    cleanText = cleanText.replace(/^'([^']*)'/g, '"\\"$1\\""');
    console.log('\n=== After handling apostrophes ===');
    console.log(cleanText);
    
    // Ensure all property names are double-quoted
    cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    console.log('\n=== After ensuring double-quoted properties ===');
    console.log(cleanText);
    
    // Remove any extra spaces and normalize newlines
    cleanText = cleanText
      .replace(/\n\s*/g, ' ')  // Replace newlines and their surrounding whitespace with a single space
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .replace(/\s*([{}[\],:])\s*/g, '$1'); // Remove spaces around JSON syntax characters
    
    console.log('\n=== Final cleaned text ===');
    console.log(cleanText);
    
    // Try to parse the JSON
    try {
      const parsed = JSON.parse(cleanText);
      console.log('\n=== Successfully parsed JSON ===');
      return parsed;
    } catch (parseError) {
      // If parsing fails, try to find the exact position of the error
      const errorPosition = parseInt(parseError.message.match(/\d+/)[0]);
      console.error('\n=== JSON Parse Error Details ===');
      console.error('Error position:', errorPosition);
      console.error('Text before error:', cleanText.substring(Math.max(0, errorPosition - 50), errorPosition));
      console.error('Text after error:', cleanText.substring(errorPosition, Math.min(cleanText.length, errorPosition + 50)));
      console.error('Full cleaned text:', cleanText);
      throw parseError;
    }
  } catch (error) {
    console.error('\n=== Error cleaning JSON ===');
    console.error('Error:', error);
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
          temperature: 0.3,
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
    console.log('\n=== Raw response from Gemini ===');
    console.log(responseText);
    
    return cleanAndParseJSON(responseText);
  } catch (error) {
    console.error('Error analyzing bookmarks:', error);
    throw error;
  }
}

// Run the test
console.log('Starting test with sample bookmarks...');
analyzeBookmarks(testBookmarks)
  .then(result => {
    console.log('\n=== Final Result ===');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n=== Test Failed ===');
    console.error(error);
  }); 