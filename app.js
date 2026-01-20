// Global variables
let imageData = null;
let colorData = {};
let allPixels = []; // Store all pixel colors for grouping

// DOM elements
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', {
    willReadFrequently: true
    // Note: Cannot access ICC color profile transformed data via getImageData()
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

    // Check JPEG header for color space information
    checkJPEGColorSpace(file);

    // Use traditional image loading method - it reliably applies color profiles
    // createImageBitmap has issues with colorSpaceConversion options, causing
    // images with embedded color profiles to be read incorrectly
    console.log('Loading image using traditional method to ensure color profiles are applied...');
    loadImageTraditional(file);
}

// Check JPEG color space from file header
function checkJPEGColorSpace(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const arr = new Uint8Array(e.target.result).subarray(0, 4000);
        let view = new DataView(arr.buffer);

        // Check for JPEG SOI marker (0xFFD8)
        if (view.getUint16(0) !== 0xFFD8) {
            console.log('Not a JPEG file or unable to read header');
            return;
        }

        // Look for APP14 marker which contains color space info
        let offset = 2;
        let foundColorInfo = false;

        while (offset < arr.length - 1) {
            if (arr[offset] !== 0xFF) break;

            const marker = arr[offset + 1];
            const length = (arr[offset + 2] << 8) | arr[offset + 3];

            // APP14 marker (0xFFEE) contains Adobe color transform info
            if (marker === 0xEE && offset + 14 < arr.length) {
                const transform = arr[offset + 13];
                console.log('JPEG Color Info - Adobe APP14 marker found');
                console.log('Color transform value:', transform);
                console.log('  0 = Unknown (possibly CMYK or RGB)');
                console.log('  1 = YCbCr (standard)');
                console.log('  2 = YCCK (CMYK)');
                foundColorInfo = true;

                if (transform === 0 || transform === 2) {
                    console.warn('⚠️ WARNING: This JPEG may be in CMYK or non-standard color space!');
                    console.warn('⚠️ Chrome has bugs reading pixel data from CMYK JPEGs.');
                    alert('Warning: This image appears to be in CMYK or non-standard color space. The color detection may not work correctly. Please convert the image to RGB color space.');
                }
            }

            // SOF markers that contain color space info
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                const components = arr[offset + 9];
                console.log(`JPEG has ${components} color components`);
                if (components === 1) {
                    console.log('⚠️ This is a grayscale JPEG (1 component)');
                } else if (components === 3) {
                    console.log('This is an RGB/YCbCr JPEG (3 components)');
                } else if (components === 4) {
                    console.warn('⚠️ WARNING: This appears to be a CMYK JPEG (4 components)!');
                    alert('Warning: This image appears to be in CMYK color space. Chrome cannot correctly read pixel data from CMYK JPEGs. Please convert to RGB.');
                }
                foundColorInfo = true;
            }

            offset += 2 + length;
        }

        if (!foundColorInfo) {
            console.log('Could not determine JPEG color space from header');
        }
    };
    reader.readAsArrayBuffer(file.slice(0, 4000)); // Read first 4KB
}

// Process image (bitmap or Image object)
function processImage(source) {
    console.log(`Processing image: ${source.width}x${source.height}`);

    // Set canvas dimensions to match image
    canvas.width = source.width;
    canvas.height = source.height;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image/bitmap on canvas
    ctx.drawImage(source, 0, 0);

    // Show image preview
    imagePreview.classList.remove('hidden');

    // Sample multiple pixels to check colors are being read correctly
    console.log('Sampling pixel colors from different locations:');
    const locations = [
        [Math.floor(source.width / 2), Math.floor(source.height / 2), 'center'],
        [Math.floor(source.width / 4), Math.floor(source.height / 4), 'top-left quadrant'],
        [Math.floor(source.width * 3/4), Math.floor(source.height * 3/4), 'bottom-right quadrant']
    ];

    locations.forEach(([x, y, label]) => {
        const testPixels = ctx.getImageData(x, y, 1, 1).data;
        console.log(`${label} [${x},${y}]: RGB(${testPixels[0]}, ${testPixels[1]}, ${testPixels[2]}, alpha: ${testPixels[3]})`);
    });

    // Analyze colors directly
    // Note: getImageData() returns raw pixel data without ICC color profile transformations
    analyzeColors();
}

// Fallback to traditional image loading
function loadImageTraditional(file) {
    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();

        img.onload = function() {
            console.log(`Image loaded via traditional method: ${img.width}x${img.height}`);
            processImage(img);
        };

        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

// Try to read pixels using WebGL (may preserve color transformations)
function tryWebGLPixelRead() {
    try {
        // Create an offscreen canvas for WebGL
        const webglCanvas = document.createElement('canvas');
        webglCanvas.width = canvas.width;
        webglCanvas.height = canvas.height;

        // Try to get WebGL context
        const gl = webglCanvas.getContext('webgl2') || webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl');

        if (!gl) {
            console.log('WebGL not supported');
            return null;
        }

        console.log('WebGL context created successfully');

        // Create a texture from the display canvas
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Upload the canvas image to the texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Create a framebuffer
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        // Check if framebuffer is complete
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete');
            return null;
        }

        // Read pixels from the framebuffer
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Clean up
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(framebuffer);

        console.log('WebGL readPixels completed');
        return pixels;

    } catch (error) {
        console.error('Error in WebGL pixel read:', error);
        return null;
    }
}

// Analyze colors in the image
function analyzeColors() {
    let pixels;

    try {
        // Try WebGL approach first - it may give us rendered pixel data
        console.log('Attempting to read pixels using WebGL...');
        pixels = tryWebGLPixelRead();

        if (pixels) {
            console.log('✅ Successfully read pixels using WebGL!');
            console.log(`First pixel via WebGL: RGB(${pixels[0]}, ${pixels[1]}, ${pixels[2]}, ${pixels[3]})`);
        } else {
            console.log('❌ WebGL not available, falling back to Canvas 2D...');

            // Fallback to Canvas 2D
            const analysisCanvas = document.createElement('canvas');
            analysisCanvas.width = canvas.width;
            analysisCanvas.height = canvas.height;
            const analysisCtx = analysisCanvas.getContext('2d', {
                willReadFrequently: true
            });

            // Copy the image from display canvas to analysis canvas
            analysisCtx.drawImage(canvas, 0, 0);

            console.log('Reading pixel data from Canvas 2D...');

            // Get image data from the fresh canvas
            imageData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
            pixels = imageData.data;
        }

        // Verify the pixels and check if they're actually grayscale
        console.log(`First pixel: RGB(${pixels[0]}, ${pixels[1]}, ${pixels[2]}, ${pixels[3]})`);
        console.log(`Pixel at index 1000: RGB(${pixels[4000]}, ${pixels[4001]}, ${pixels[4002]}, ${pixels[4003]})`);

        // Check if image is actually grayscale (all R=G=B) even though it displays in color
        let grayscaleCount = 0;
        let colorCount = 0;
        const sampleSize = Math.min(10000, pixels.length / 4); // Sample 10000 pixels or less

        for (let i = 0; i < sampleSize * 4; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            if (r === g && g === b) {
                grayscaleCount++;
            } else {
                colorCount++;
            }
        }

        const grayscalePercent = (grayscaleCount / sampleSize) * 100;
        console.log(`\n⚠️ PIXEL DATA ANALYSIS:`);
        console.log(`Sampled ${sampleSize} pixels:`);
        console.log(`  - Grayscale pixels (R=G=B): ${grayscaleCount} (${grayscalePercent.toFixed(1)}%)`);
        console.log(`  - Color pixels (R≠G≠B): ${colorCount} (${(100-grayscalePercent).toFixed(1)}%)`);

        // Lower threshold to 80% to catch more cases
        if (grayscalePercent > 80) {
            console.error(`\n🔴 ICC COLOR PROFILE ISSUE DETECTED:`);
            console.error(`The pixel data is ${grayscalePercent.toFixed(1)}% grayscale, but the image displays in color.`);
            console.error(`\nThis is a browser limitation:`);
            console.error(`  • Your image contains grayscale pixels (R=G=B)`);
            console.error(`  • An embedded ICC color profile maps those to colors for display`);
            console.error(`  • But Canvas getImageData() cannot access the color-transformed data`);
            console.error(`  • There's no way to extract the displayed colors using JavaScript`);

            alert(`⚠️ ICC Color Profile Detected\n\nYour image displays in color but contains grayscale pixel data with an embedded color profile.\n\nBrowsers cannot extract the color-transformed pixel data through JavaScript.\n\n📋 HOW TO FIX:\n\n1. Open your image in image editing software (Photoshop, GIMP, etc.)\n\n2. "Flatten" or "Apply" the color profile:\n   • Photoshop: Edit → Convert to Profile → sRGB\n   • GIMP: Image → Flatten Image, then Image → Mode → RGB\n\n3. Save as a new JPEG or PNG\n\n4. Upload the new file to this tool\n\nThis will bake the colors into the actual pixel data.`);

            return; // Stop current analysis
        }
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
