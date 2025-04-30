# Bookmark Wizard

A Chrome extension that uses AI to help organize your bookmarks into meaningful categories.

## Features

- Analyzes your bookmarks using Google's Gemini AI to suggest meaningful categories
- Automatically organizes bookmarks into folders based on the analysis
- Simple and intuitive user interface
- Secure handling of your bookmarks

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. Add your Google Gemini API key in the `background.js` file (replace the empty string in `LLM_API_KEY`)

## Usage

1. Click the Bookmark Wizard icon in your Chrome toolbar
2. Click "Analyze Bookmarks" to start the analysis process
3. Once analysis is complete, click "Organize Bookmarks" to automatically sort your bookmarks into folders
4. The extension will create new folders and move your bookmarks accordingly

## Requirements

- Chrome browser
- Google Gemini API key (get one from Google AI Studio)

## Privacy

This extension:
- Only accesses your bookmarks
- Does not store any data externally
- Uses the Google Gemini API for bookmark analysis
- Does not share your data with any third parties

## Development

To modify or enhance the extension:

1. Make your changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test your changes

## License

MIT License 