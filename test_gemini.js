// Configuration for the LLM API
const LLM_API_KEY = 'AIzaSyAd95HuZprHOg60u0p7EE-v0iMtMaFERAQ';
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
    console.log('\nCleaning steps:');
    
    // Remove any markdown formatting
    let cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
    console.log('1. After removing markdown:', cleanText.substring(0, 100) + '...');
    
    // Find the first { and last } to extract just the JSON object
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}') + 1;
    if (startIndex === -1 || endIndex === 0) {
      throw new Error('No valid JSON object found in response');
    }
    cleanText = cleanText.slice(startIndex, endIndex);
    console.log('2. After extracting JSON object:', cleanText.substring(0, 100) + '...');
    
    // Replace any single quotes with double quotes
    cleanText = cleanText.replace(/'/g, '"');
    console.log('3. After replacing single quotes:', cleanText.substring(0, 100) + '...');
    
    // Ensure all property names are double-quoted
    cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    console.log('4. After ensuring double quotes:', cleanText.substring(0, 100) + '...');
    
    // Remove any extra spaces and normalize newlines
    cleanText = cleanText
      .replace(/\n\s*/g, ' ')  // Replace newlines and their surrounding whitespace with a single space
      .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
      .replace(/\s*([{}[\],:])\s*/g, '$1'); // Remove spaces around JSON syntax characters
    
    console.log('5. After normalizing whitespace:', cleanText.substring(0, 100) + '...');
    
    // Try to parse the JSON
    try {
      return JSON.parse(cleanText);
    } catch (parseError) {
      // If parsing fails, try to find the exact position of the error
      const errorPosition = parseInt(parseError.message.match(/\d+/)[0]);
      console.error('\nJSON Parse Error Details:');
      console.error('Error position:', errorPosition);
      console.error('Text before error:', cleanText.substring(Math.max(0, errorPosition - 50), errorPosition));
      console.error('Text after error:', cleanText.substring(errorPosition, Math.min(cleanText.length, errorPosition + 50)));
      console.error('Full cleaned text:', cleanText);
      throw parseError;
    }
  } catch (error) {
    console.error('\nError cleaning JSON:', error);
    console.error('Original text:', text);
    throw new Error('Failed to parse JSON response: ' + error.message);
  }
}

// Function to analyze bookmarks using Gemini
async function analyzeBookmarks(bookmarks) {
  const prompt = `You are a bookmark categorization assistant. Analyze these bookmarks and suggest categories for them.
    For each bookmark, provide a category and a brief explanation.
    IMPORTANT: Respond with ONLY a valid JSON object, no markdown formatting, no backticks, no additional text.
    The JSON must follow this exact structure and use double quotes for all property names:
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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    const data = await response.json();
    console.log('\nRaw response from Gemini:');
    console.log(JSON.stringify(data, null, 2));

    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const responseText = data.candidates[0].content.parts[0].text;
    console.log('\nResponse text before cleaning:');
    console.log(responseText);

    const cleanedJson = cleanAndParseJSON(responseText);
    console.log('\nCleaned and parsed JSON:');
    console.log(JSON.stringify(cleanedJson, null, 2));

    return cleanedJson;
  } catch (error) {
    console.error('Error analyzing bookmarks:', error);
    throw error;
  }
}

// Run the test with real bookmarks
console.log('Starting test with real bookmarks...');
getAllBookmarks()
  .then(bookmarks => {
    console.log(`Found ${bookmarks.length} bookmarks to analyze`);
    return analyzeBookmarks(bookmarks);
  })
  .then(result => {
    console.log('\nTest completed successfully!');
  })
  .catch(error => {
    console.error('\nTest failed:', error);
  }); 