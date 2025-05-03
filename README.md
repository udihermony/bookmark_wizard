# Bookmark Wizard

A Chrome extension that uses AI to help organize your bookmarks into meaningful categories.

## Features

- Analyzes your bookmarks using Ollama's local AI to suggest meaningful categories
- Automatically organizes bookmarks into folders based on the analysis
- Simple and intuitive user interface
- Secure handling of your bookmarks (all processing happens locally)

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. Make sure Ollama is installed and running on your computer

## Requirements

- Chrome browser
- [Ollama](https://ollama.ai/) installed and running locally
- Qwen3 model pulled in Ollama (run `ollama pull qwen3:32b`)

## Usage

1. Make sure Ollama is running locally (`ollama serve` in your terminal)
2. Click the Bookmark Wizard icon in your Chrome toolbar
3. Click "Analyze Bookmarks" to start the analysis process
4. Once analysis is complete, click "Organize Bookmarks" to automatically sort your bookmarks into folders
5. The extension will create new folders and move your bookmarks accordingly

## Troubleshooting

If you see "Error: Failed to fetch" when analyzing bookmarks, check that:
- Ollama is installed and running on your computer
- The Qwen3 model is pulled and available in Ollama
- Your firewall isn't blocking connections to localhost:11434

## Privacy

This extension:
- Only accesses your bookmarks
- All AI processing happens locally using Ollama
- Does not send your data to any external servers
- Does not share your data with any third parties

## Development

To modify or enhance the extension:

1. Make your changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test your changes

## License

MIT License