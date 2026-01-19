// Global variables
let imageData = null;
let colorData = {};

// DOM elements
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imagePreview = document.getElementById('imagePreview');
const results = document.getElementById('results');
const colorList = document.getElementById('colorList');
const totalPixelsEl = document.getElementById('totalPixels');
const uniqueColorsEl = document.getElementById('uniqueColors');
const colorLimitInput = document.getElementById('colorLimit');
const updateButton = document.getElementById('updateResults');

// Event listeners
imageInput.addEventListener('change', handleImageUpload);
updateButton.addEventListener('click', () => displayResults(colorData));

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

        img.onload = function() {
            // Set canvas dimensions to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image on canvas
            ctx.drawImage(img, 0, 0);

            // Show image preview
            imagePreview.classList.remove('hidden');

            // Analyze colors
            analyzeColors();
        };

        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

// Analyze colors in the image
function analyzeColors() {
    // Get image data from canvas
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Object to store color counts
    const colorCounts = {};
    const totalPixels = canvas.width * canvas.height;

    // Loop through all pixels
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip fully transparent pixels
        if (a === 0) continue;

        // Create color key in RGB format
        const colorKey = `${r},${g},${b}`;

        // Count color occurrences
        if (colorCounts[colorKey]) {
            colorCounts[colorKey]++;
        } else {
            colorCounts[colorKey] = 1;
        }
    }

    // Convert counts to percentages
    colorData = {};

    for (const [color, count] of Object.entries(colorCounts)) {
        const percentage = (count / totalPixels) * 100;
        colorData[color] = {
            count: count,
            percentage: percentage
        };
    }

    // Display results
    displayResults(colorData);
}

// Display color analysis results
function displayResults(data) {
    // Get color limit from input
    const limit = parseInt(colorLimitInput.value) || 10;

    // Sort colors by percentage (descending)
    const sortedColors = Object.entries(data).sort((a, b) =>
        b[1].percentage - a[1].percentage
    );

    // Clear previous results
    colorList.innerHTML = '';

    // Take top N colors
    const topColors = sortedColors.slice(0, limit);

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
