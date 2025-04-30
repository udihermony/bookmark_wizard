#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is not installed. Please install it first."
    echo "On macOS: brew install imagemagick"
    echo "On Ubuntu: sudo apt-get install imagemagick"
    exit 1
fi

# Create icons directory if it doesn't exist
mkdir -p icons

# Convert SVG to different PNG sizes
convert -background none -size 16x16 icons/icon.svg icons/icon16.png
convert -background none -size 48x48 icons/icon.svg icons/icon48.png
convert -background none -size 128x128 icons/icon.svg icons/icon128.png

echo "Icons have been created successfully!" 