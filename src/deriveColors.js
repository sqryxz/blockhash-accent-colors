/**
 * deriveColors.js - Color Derivation Module
 * Derives accent colors from blockchain ledger hash using SHA256
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
    console.error('[deriveColors] Failed to load config:', error);
    throw error;
  }
}

/**
 * Compute SHA256 hash of input string
 * @param {string} input - Input string to hash
 * @returns {string} Hex-encoded SHA256 hash
 */
async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex string to HSL color
 * @param {string} hex - Hex color string (e.g., "ff5500")
 * @returns {object} HSL color object {h, s, l}
 */
function hexToHsl(hex) {
  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to CSS string
 * @param {object} hsl - HSL color object {h, s, l}
 * @returns {string} CSS hsl string
 */
function hslToCss(hsl) {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Derive a single color from a hash segment
 * @param {string} hashSegment - 6-character hex segment
 * @param {object} cfg - Color configuration
 * @returns {object} Color object with hsl and hex
 */
function deriveSingleColor(hashSegment, cfg) {
  // Parse hue from first 3 chars (0-4095 -> 0-360)
  const hue = (parseInt(hashSegment.substring(0, 3), 16) / 4095) * 360;
  
  // Get saturation and lightness from config ranges
  const satRange = cfg.colorDerivation?.saturationRange || [0.6, 0.9];
  const lightRange = cfg.colorDerivation?.lightnessRange || [0.4, 0.7];
  
  // Parse saturation from hash (0-255 -> range)
  const satNorm = parseInt(hashSegment.substring(3, 5), 16) / 255;
  const saturation = satRange[0] + satNorm * (satRange[1] - satRange[0]);
  
  // Parse lightness from hash (0-255 -> range)
  const lightNorm = parseInt(hashSegment.substring(5, 6), 16) / 15;
  const lightness = lightRange[0] + lightNorm * (lightRange[1] - lightRange[0]);
  
  const hsl = {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
  
  // Convert to hex for storage
  const hex = hslToHex(hsl);
  
  return {
    hsl,
    css: hslToCss(hsl),
    hex
  };
}

/**
 * Convert HSL to hex
 * @param {object} hsl - HSL color object
 * @returns {string} Hex color string
 */
function hslToHex(hsl) {
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hsl.h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (hsl.h >= 0 && hsl.h < 60) { r = c; g = x; b = 0; }
  else if (hsl.h >= 60 && hsl.h < 120) { r = x; g = c; b = 0; }
  else if (hsl.h >= 120 && hsl.h < 180) { r = 0; g = c; b = x; }
  else if (hsl.h >= 180 && hsl.h < 240) { r = 0; g = x; b = c; }
  else if (hsl.h >= 240 && hsl.h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  const toHex = n => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derive accent colors from parsed ledger data
 * @param {object} parsedData - Output from parseLedger
 * @returns {object} Derived colors and metadata
 */
async function deriveColors(parsedData) {
  const cfg = await loadConfig();
  const paletteSize = cfg.colorDerivation?.paletteSize || 6;
  
  if (!parsedData || !parsedData.hash) {
    console.warn('[deriveColors] No hash provided for color derivation');
    return {
      palette: [],
      primaryColor: null,
      hash: null,
      algorithm: cfg.colorDerivation?.algorithm || 'sha256'
    };
  }
  
  const hash = parsedData.hash;
  const algorithm = parsedData.algorithm || cfg.colorDerivation?.algorithm || 'sha256';
  
  console.log('[deriveColors] Deriving colors from hash:', hash.substring(0, 16) + '...');
  
  // Generate deterministic hash for color palette using SHA256
  const fullHash = await sha256(hash);
  
  // Extract color segments (6 chars each = 3 bytes = RGB)
  const palette = [];
  const segmentLength = 6;
  
  for (let i = 0; i < paletteSize; i++) {
    const startIdx = i * segmentLength;
    // Cycle through the hash if we need more colors than hash length allows
    const segment = fullHash.substring(startIdx % 64, (startIdx % 64) + segmentLength);
    
    if (segment.length === segmentLength) {
      const color = deriveSingleColor(segment, cfg);
      palette.push({
        index: i,
        ...color,
        fromHash: hash.substring(0, 8) + '...'
      });
    }
  }
  
  // Primary color is the first in the palette
  const primaryColor = palette[0] || null;
  
  // Generate complementary accent
  let accentColor = null;
  if (primaryColor) {
    const accentHue = (primaryColor.hsl.h + 180) % 360;
    accentColor = {
      hsl: { h: accentHue, s: primaryColor.hsl.s, l: primaryColor.hsl.l },
      css: `hsl(${accentHue}, ${primaryColor.hsl.s}%, ${primaryColor.hsl.l}%)`,
      hex: hslToHex({ h: accentHue, s: primaryColor.hsl.s, l: primaryColor.hsl.l })
    };
  }
  
  console.log('[deriveColors] Derived palette:', palette.length, 'colors');
  
  return {
    palette,
    primaryColor,
    accentColor,
    hash,
    algorithm,
    metadata: parsedData.metadata || {},
    derivedAt: new Date().toISOString()
  };
}

/**
 * Generate CSS variables from palette
 * @param {object} colorData - Output from deriveColors
 * @returns {string} CSS variables string
 */
function generateCssVariables(colorData) {
  const vars = [];
  
  if (colorData.primaryColor) {
    vars.push(`--primary-color: ${colorData.primaryColor.css};`);
    vars.push(`--primary-hex: ${colorData.primaryColor.hex};`);
  }
  
  if (colorData.accentColor) {
    vars.push(`--accent-color: ${colorData.accentColor.css};`);
    vars.push(`--accent-hex: ${colorData.accentColor.hex};`);
  }
  
  colorData.palette.forEach((color, idx) => {
    vars.push(`--color-${idx + 1}: ${color.css};`);
    vars.push(`--color-${idx + 1}-hex: ${color.hex};`);
  });
  
  return vars.join('\n  ');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadConfig,
    sha256,
    hexToHsl,
    hslToCss,
    hslToHex,
    deriveColors,
    generateCssVariables
  };
}

// ES Module export
export {
  loadConfig,
  sha256,
  hexToHsl,
  hslToCss,
  hslToHex,
  deriveColors,
  generateCssVariables
};
