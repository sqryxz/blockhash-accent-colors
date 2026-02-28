/**
 * publish.js - File Output Handler Module
 * Publishes derived colors to various output formats
 */

const CONFIG_PATH = '../inputs/config.json';

let config = null;

/**
 * Load configuration
 */
async function loadConfig() {
  if (config) return config;
  
  try {
    // Check if we're in Node.js or browser
    if (typeof window === 'undefined' && typeof process === 'object') {
      // Node.js: use fs with import.meta.url
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const configPath = join(__dirname, CONFIG_PATH);
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } else {
      // Browser: use fetch
      const response = await fetch(CONFIG_PATH);
      config = await response.json();
    }
    return config;
  } catch (error) {
    console.error('[publish] Failed to load config:', error);
    throw error;
  }
}

/**
 * Generate CSS variables from palette
 * @param {object} colorData - Output from deriveColors
 * @returns {string} CSS variables string
 */
function generateCssVariables(colorData) {
  const vars = [];
  const timestamp = new Date().toISOString();
  
  // Header
  vars.push(`/* BlockHash Accent Colors - Generated ${timestamp} */`);
  vars.push(`/* Source Hash: ${colorData.hash || 'N/A'} */`);
  vars.push(':root {');
  
  if (colorData.primaryColor) {
    vars.push(`  --primary-color: ${colorData.primaryColor.css};`);
    vars.push(`  --primary-hex: ${colorData.primaryColor.hex};`);
    vars.push(`  --primary-hsl: ${colorData.primaryColor.hsl.h}, ${colorData.primaryColor.hsl.s}%, ${colorData.primaryColor.hsl.l}%;`);
  }
  
  if (colorData.accentColor) {
    vars.push(`  --accent-color: ${colorData.accentColor.css};`);
    vars.push(`  --accent-hex: ${colorData.accentColor.hex};`);
    vars.push(`  --accent-hsl: ${colorData.accentColor.hsl.h}, ${colorData.accentColor.hsl.s}%, ${colorData.accentColor.hsl.l}%;`);
  }
  
  // Full palette
  colorData.palette.forEach((color, idx) => {
    vars.push(`  --color-${idx + 1}: ${color.css};`);
    vars.push(`  --color-${idx + 1}-hex: ${color.hex};`);
    vars.push(`  --color-${idx + 1}-hsl: ${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%;`);
  });
  
  vars.push('}');
  
  return vars.join('\n');
}

/**
 * Generate JSON output from color data
 * @param {object} colorData - Output from deriveColors
 * @returns {string} JSON string
 */
function generateJsonOutput(colorData) {
  const output = {
    generatedAt: new Date().toISOString(),
    sourceHash: colorData.hash,
    algorithm: colorData.algorithm,
    primary: colorData.primaryColor ? {
      hex: colorData.primaryColor.hex,
      css: colorData.primaryColor.css,
      hsl: colorData.primaryColor.hsl
    } : null,
    accent: colorData.accentColor ? {
      hex: colorData.accentColor.hex,
      css: colorData.accentColor.css,
      hsl: colorData.accentColor.hsl
    } : null,
    palette: colorData.palette.map(c => ({
      index: c.index,
      hex: c.hex,
      css: c.css,
      hsl: c.hsl
    }))
  };
  
  return JSON.stringify(output, null, 2);
}

/**
 * Generate HTML preview snippet
 * @param {object} colorData - Output from deriveColors
 * @returns {string} HTML snippet
 */
function generateHtmlPreview(colorData) {
  const colors = colorData.palette.map(c => c.hex);
  const primary = colorData.primaryColor?.hex || '#000000';
  const accent = colorData.accentColor?.hex || '#ffffff';
  
  return `
<!-- BlockHash Accent Colors Preview -->
<div class="blockhash-colors" data-hash="${colorData.hash}">
  <div class="palette" style="display: flex; gap: 4px;">
    ${colors.map(c => `<div style="width: 32px; height: 32px; background: ${c}; border-radius: 4px;" title="${c}"></div>`).join('')}
  </div>
  <div class="primary" style="color: ${primary};">Primary: ${primary}</div>
  <div class="accent" style="color: ${accent};">Accent: ${accent}</div>
</div>
`.trim();
}

/**
 * Publish color data to output files (Node.js)
 * @param {object} colorData - Output from deriveColors
 * @param {object} options - Publishing options
 * @returns {object} Publish results
 */
async function publishToFile(colorData, options = {}) {
  const cfg = await loadConfig();
  const outputDir = options.outputDir || cfg.output?.publicDir || 'public';
  
  const results = {
    success: true,
    outputs: [],
    errors: []
  };
  
  // Check if we're in Node.js
  if (typeof window !== 'undefined') {
    console.warn('[publish] publishToFile is only available in Node.js environment');
    results.success = false;
    results.errors.push('publishToFile requires Node.js environment');
    return results;
  }
  
  const { writeFile, mkdir } = await import('fs/promises');
  const { join, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  
  // Get current module directory
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const baseDir = join(__dirname, '..');
  
  // Ensure output directory exists
  try {
    await mkdir(join(baseDir, outputDir), { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  
  // Write CSS variables file
  if (options.css !== false) {
    const cssPath = join(baseDir, outputDir, 'colors.css');
    const cssContent = generateCssVariables(colorData);
    try {
      await writeFile(cssPath, cssContent, 'utf-8');
      results.outputs.push({ type: 'css', path: cssPath });
      console.log('[publish] Wrote CSS variables to:', cssPath);
    } catch (err) {
      results.errors.push(`Failed to write CSS: ${err.message}`);
      results.success = false;
    }
  }
  
  // Write JSON file
  if (options.json !== false) {
    const jsonPath = join(baseDir, outputDir, 'colors.json');
    const jsonContent = generateJsonOutput(colorData);
    try {
      await writeFile(jsonPath, jsonContent, 'utf-8');
      results.outputs.push({ type: 'json', path: jsonPath });
      console.log('[publish] Wrote JSON to:', jsonPath);
    } catch (err) {
      results.errors.push(`Failed to write JSON: ${err.message}`);
      results.success = false;
    }
  }
  
  // Write HTML preview
  if (options.html !== false) {
    const htmlPath = join(baseDir, outputDir, 'colors-preview.html');
    const htmlContent = generateHtmlPreview(colorData);
    try {
      await writeFile(htmlPath, htmlContent, 'utf-8');
      results.outputs.push({ type: 'html', path: htmlPath });
      console.log('[publish] Wrote HTML preview to:', htmlPath);
    } catch (err) {
      results.errors.push(`Failed to write HTML: ${err.message}`);
      results.success = false;
    }
  }
  
  return results;
}

/**
 * Browser-compatible publish (returns data for embedding)
 * @param {object} colorData - Output from deriveColors
 * @param {string} format - Output format: 'css' | 'json' | 'html'
 * @returns {string} Formatted output
 */
function publishForBrowser(colorData, format = 'css') {
  switch (format) {
    case 'css':
      return generateCssVariables(colorData);
    case 'json':
      return generateJsonOutput(colorData);
    case 'html':
      return generateHtmlPreview(colorData);
    default:
      console.warn('[publish] Unknown format:', format);
      return '';
  }
}

/**
 * Main publish function - auto-detects environment
 * @param {object} colorData - Output from deriveColors
 * @param {object} options - Publishing options
 * @returns {Promise<object>|string} Results or formatted string
 */
async function publish(colorData, options = {}) {
  // Check if we're in Node.js
  if (typeof window === 'undefined' && typeof process === 'object') {
    return publishToFile(colorData, options);
  } else {
    // Browser: return formatted string
    const format = options.format || 'css';
    return publishForBrowser(colorData, format);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadConfig,
    generateCssVariables,
    generateJsonOutput,
    generateHtmlPreview,
    publishToFile,
    publishForBrowser,
    publish
  };
}

// ES Module export
export {
  loadConfig,
  generateCssVariables,
  generateJsonOutput,
  generateHtmlPreview,
  publishToFile,
  publishForBrowser,
  publish
};
