// Global variables
let imageData = null;
let colorData = {};
let allPixels = []; // Store all pixel colors for grouping

// DOM elements
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
    colorSpace: 'srgb'  // Explicitly use sRGB color space
});
const imagePreview = document.getElementById('imagePreview');
const results = document.getElementById('results');
const colorList = document.getElementById('colorList');
const totalPixelsEl = document.getElementById('totalPixels');
const uniqueColorsEl = document.getElementById('uniqueColors');
const colorLimitInput = document.getElementById('colorLimit');
const updateButton = document.getElementById('updateResults');
const groupColorsCheckbox = document.getElementById('groupColors');
const groupingInfo = document.getElementById('groupingInfo');

// Event listeners
imageInput.addEventListener('change', handleImageUpload);
updateButton.addEventListener('click', updateDisplay);
groupColorsCheckbox.addEventListener('change', updateDisplay);

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();

        // Don't set crossOrigin for local files - this can cause issues
        // img.crossOrigin = 'anonymous';

        img.onload = function() {
            console.log(`Image loaded: ${img.width}x${img.height}`);

            // Set canvas dimensions to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Clear the canvas and reset any transforms
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw image on canvas WITHOUT white background
            // This was causing issues with color detection
            ctx.drawImage(img, 0, 0);

            // Show image preview
            imagePreview.classList.remove('hidden');

            // Sample a few pixels to check colors are being read correctly
            console.log('Sampling some pixel colors from the drawn canvas:');
            const testPixels = ctx.getImageData(
                Math.floor(img.width / 2),
                Math.floor(img.height / 2),
                1,
                1
            ).data;
            console.log(`Center pixel: RGB(${testPixels[0]}, ${testPixels[1]}, ${testPixels[2]}, alpha: ${testPixels[3]})`);

            // Analyze colors
            analyzeColors();
        };

        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

// Analyze colors in the image
function analyzeColors() {
    let pixels;

    try {
        // Get image data from canvas
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixels = imageData.data;
    } catch (error) {
        console.error('Error reading image data:', error);
        alert('Error analyzing image. The image may have security restrictions or be corrupted.');
        return;
    }

    // Object to store color counts
    const colorCounts = {};
    allPixels = []; // Reset all pixels array

    // Loop through all pixels
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip fully transparent pixels
        if (a === 0) continue;

        // Store pixel for grouping
        allPixels.push([r, g, b]);

        // Create color key in RGB format
        const colorKey = `${r},${g},${b}`;

        // Count color occurrences
        if (colorCounts[colorKey]) {
            colorCounts[colorKey]++;
        } else {
            colorCounts[colorKey] = 1;
        }
    }

    const totalPixelsAnalyzed = allPixels.length;

    // Convert counts to percentages
    colorData = {};

    for (const [color, count] of Object.entries(colorCounts)) {
        const percentage = (count / totalPixelsAnalyzed) * 100;
        colorData[color] = {
            count: count,
            percentage: percentage
        };
    }

    // Debug: Log top 10 colors
    const sortedColors = Object.entries(colorData).sort((a, b) => b[1].percentage - a[1].percentage);
    console.log('Top 10 colors detected:');
    sortedColors.slice(0, 10).forEach(([color, data], index) => {
        const [r, g, b] = color.split(',').map(Number);
        console.log(`${index + 1}. RGB(${r}, ${g}, ${b}) - ${data.percentage.toFixed(2)}% (${data.count} pixels)`);
    });
    console.log(`Total unique colors: ${Object.keys(colorData).length}`);
    console.log(`Total pixels analyzed: ${totalPixelsAnalyzed}`);

    // Debug: Check for blue-ish colors (where blue channel > red and green)
    console.log('\nLooking for blue colors (B > R and B > G):');
    const blueColors = sortedColors.filter(([color]) => {
        const [r, g, b] = color.split(',').map(Number);
        return b > r && b > g && b > 100; // Blue channel dominant and significant
    });
    console.log(`Found ${blueColors.length} blue-ish colors`);
    if (blueColors.length > 0) {
        console.log('Top 5 blue colors:');
        blueColors.slice(0, 5).forEach(([color, data], index) => {
            const [r, g, b] = color.split(',').map(Number);
            console.log(`  ${index + 1}. RGB(${r}, ${g}, ${b}) - ${data.percentage.toFixed(2)}% (${data.count} pixels)`);
        });
    } else {
        console.log('NO BLUE COLORS FOUND! This might indicate an image rendering issue.');
    }

    // Display results
    updateDisplay();
}

// Calculate Euclidean distance between two RGB colors
function colorDistance(color1, color2) {
    const [r1, g1, b1] = color1;
    const [r2, g2, b2] = color2;
    return Math.sqrt(
        Math.pow(r2 - r1, 2) +
        Math.pow(g2 - g1, 2) +
        Math.pow(b2 - b1, 2)
    );
}

// Find closest color from a palette
function findClosestColor(pixel, palette) {
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (const color of palette) {
        const distance = colorDistance(pixel, color);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }

    return closestColor;
}

// Group all pixels to nearest top N colors
function groupColors(limit) {
    // Get top N most common colors
    const sortedColors = Object.entries(colorData).sort((a, b) =>
        b[1].percentage - a[1].percentage
    );

    const topColors = sortedColors.slice(0, limit);
    const palette = topColors.map(([color]) =>
        color.split(',').map(Number)
    );

    // Count pixels assigned to each palette color
    const groupedCounts = {};
    palette.forEach(color => {
        const key = color.join(',');
        groupedCounts[key] = 0;
    });

    // Assign each pixel to nearest palette color
    for (const pixel of allPixels) {
        const closestColor = findClosestColor(pixel, palette);
        const key = closestColor.join(',');
        groupedCounts[key]++;
    }

    // Convert to percentage format
    const totalPixels = allPixels.length;
    const groupedData = {};

    for (const [color, count] of Object.entries(groupedCounts)) {
        const percentage = (count / totalPixels) * 100;
        groupedData[color] = {
            count: count,
            percentage: percentage
        };
    }

    return groupedData;
}

// Update display based on grouping setting
function updateDisplay() {
    const limit = parseInt(colorLimitInput.value) || 10;
    const shouldGroup = groupColorsCheckbox.checked;

    let dataToDisplay;

    if (shouldGroup) {
        dataToDisplay = groupColors(limit);
        groupingInfo.textContent = `Grouping all pixels to the ${limit} most common colors. Similar tones are grouped together.`;
        groupingInfo.classList.add('visible');
    } else {
        dataToDisplay = colorData;
        groupingInfo.classList.remove('visible');
    }

    displayResults(dataToDisplay, limit);
}

// Display color analysis results
function displayResults(data, limit) {
    // Sort colors by percentage (descending)
    const sortedColors = Object.entries(data).sort((a, b) =>
        b[1].percentage - a[1].percentage
    );

    // Clear previous results
    colorList.innerHTML = '';

    // Take top N colors (or all if grouping is enabled)
    const topColors = groupColorsCheckbox.checked
        ? sortedColors
        : sortedColors.slice(0, limit);

    // Display each color
    topColors.forEach(([color, data]) => {
        const [r, g, b] = color.split(',').map(Number);

        // Create color item element
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';

        // Color swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

        // Color info
        const info = document.createElement('div');
        info.className = 'color-info';

        const hex = document.createElement('div');
        hex.className = 'color-hex';
        hex.textContent = rgbToHex(r, g, b);

        const rgb = document.createElement('div');
        rgb.className = 'color-rgb';
        rgb.textContent = `RGB(${r}, ${g}, ${b})`;

        const percentageBar = document.createElement('div');
        percentageBar.className = 'percentage-bar';

        const percentageFill = document.createElement('div');
        percentageFill.className = 'percentage-fill';
        percentageFill.style.width = `${data.percentage}%`;

        percentageBar.appendChild(percentageFill);

        info.appendChild(hex);
        info.appendChild(rgb);
        info.appendChild(percentageBar);

        // Percentage
        const percentage = document.createElement('div');
        percentage.className = 'color-percentage';
        percentage.textContent = `${data.percentage.toFixed(2)}%`;

        // Assemble color item
        colorItem.appendChild(swatch);
        colorItem.appendChild(info);
        colorItem.appendChild(percentage);

        colorList.appendChild(colorItem);
    });

    // Update stats
    const totalPixels = Object.values(data).reduce((sum, color) => sum + color.count, 0);
    totalPixelsEl.textContent = totalPixels.toLocaleString();
    uniqueColorsEl.textContent = Object.keys(data).length.toLocaleString();

    // Show results section
    results.classList.remove('hidden');
}

// Convert RGB to Hex
function rgbToHex(r, g, b) {
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
