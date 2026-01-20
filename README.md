# Image Color Percentage Calculator

A simple web application built with vanilla HTML, CSS, and JavaScript that analyzes uploaded images and calculates the percentage of each color present.

## Features

- Upload any image file (PNG, JPG, GIF, etc.)
- Analyze all colors present in the image
- Display the top N most common colors (customizable)
- **Color Grouping**: Group similar tones together by assigning all pixels to the nearest of the top N colors
  - Perfect for simplifying complex images with many color variations
  - Red-ish tones group to red, blue-ish to blue, etc.
- Show color information in multiple formats:
  - Hexadecimal (#RRGGBB)
  - RGB values
  - Percentage of total pixels
- Visual color swatches and percentage bars
- Statistics showing total pixels and unique colors
- Responsive design for mobile and desktop

## How to Use

1. Open `index.html` in your web browser
2. Click the "Choose an image" button to upload an image
3. The app will automatically analyze the image and display results
4. Adjust the "Number of colors" field to show more or fewer colors
5. **Optional**: Enable "Group similar colors" to assign all pixels to the nearest of the top N colors
   - This creates a simplified color palette where similar shades are grouped together
   - Percentages will always add up to 100%
6. Click "Update" to refresh the results with the new settings

## Technical Details

### Color Analysis Algorithm

**Standard Mode:**
1. The image is drawn onto an HTML5 canvas
2. Pixel data is extracted using `getImageData()`
3. Each pixel's RGB values are recorded
4. Colors are counted and calculated as percentages of total pixels
5. Results are sorted by frequency and displayed

**Color Grouping Mode:**
1. First, identify the top N most common colors in the image
2. For each pixel in the image, calculate the Euclidean distance to each of the N colors
3. Assign each pixel to the nearest color using the minimum distance
4. Recalculate percentages based on the grouped assignments
5. This effectively creates a color palette reduction/quantization

### Files

- `index.html` - Main HTML structure
- `styles.css` - Styling and layout
- `app.js` - Color analysis logic and UI interactions

## Browser Compatibility

This app uses standard web APIs and should work in all modern browsers:
- Chrome/Edge
- Firefox
- Safari
- Opera

## Privacy

All image processing happens locally in your browser. No images are uploaded to any server.

## License

This project is open source and available for use.
