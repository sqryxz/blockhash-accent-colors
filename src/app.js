/**
 * BlockHash Accent Colors - Main Application
 * Fetches blockchain ledger hash and derives accent colors
 */

const CONFIG_PATH = '../inputs/config.json';

// State
let config = null;
let currentBlockHash = null;
let currentAccents = null;
let autoRefreshInterval = null;

/**
 * Copy text to clipboard with fallback
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (error) {
    console.error('Failed to copy:', error);
    return false;
  }
}

/**
 * Show copy feedback toast
 */
function showCopyFeedback(element, originalText) {
  const feedback = document.createElement('span');
  feedback.className = 'copy-feedback';
  feedback.textContent = 'Copied!';
  
  const rect = element.getBoundingClientRect();
  feedback.style.position = 'fixed';
  feedback.style.left = `${rect.left + rect.width / 2}px`;
  feedback.style.top = `${rect.top - 10}px`;
  feedback.style.transform = 'translate(-50%, -100%)';
  feedback.style.zIndex = '1000';
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.remove();
  }, 1500);
}

/**
 * Load configuration
 */
async function loadConfig() {
  try {
    const response = await fetch(CONFIG_PATH);
    config = await response.json();
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    showStatus('Failed to load configuration', 'error');
    return null;
  }
}

/**
 * Fetch current blockchain ledger hash with full block data
 */
async function fetchBlockchainHash() {
  const blockchainConfig = config.blockchain;
  
  try {
    showStatus('Fetching blockchain data...', 'loading');
    
    // Fetch block data from API
    const response = await fetch(blockchainConfig.api_url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Get the hash - handle different API response formats
    let hash = blockchainConfig.hash_path 
      ? data[blockchainConfig.hash_path.replace('.', '')] 
      : data.block?.hash || data.hash || data;
    
    // If API returns array of blocks, get the first one
    if (Array.isArray(hash)) {
      hash = hash[0]?.hash || hash[0];
    }
    
    currentBlockHash = hash;
    document.getElementById('block-hash').textContent = hash;
    
    // Update metadata if available
    if (data[0]) {
      const block = data[0];
      const heightEl = document.getElementById('block-height');
      const txEl = document.getElementById('tx-count');
      if (heightEl) heightEl.textContent = block.height?.toLocaleString() || '-';
      if (txEl) txEl.textContent = block.tx_count?.toLocaleString() || '-';
    }
    
    showStatus('Blockchain data fetched', 'success');
    return hash;
  } catch (error) {
    console.error('Failed to fetch blockchain:', error);
    showStatus(`Error: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Derive accent colors from hash using config parameters
 */
function deriveAccentsFromHash(hash) {
  const derivation = config.color_derivation;
  
  // Convert hash to numeric seeds
  const hashBytes = hashToBytes(hash);
  
  // Generate colors based on method
  const colors = [];
  const numColors = derivation.num_colors || 3;
  
  for (let i = 0; i < numColors; i++) {
    const seed = hashBytes[i % hashBytes.length] * 256 + hashBytes[(i + 1) % hashBytes.length];
    const color = generateColor(seed, derivation);
    colors.push(color);
  }
  
  currentAccents = colors;
  return colors;
}

/**
 * Convert hash string to byte array
 */
function hashToBytes(hash) {
  const bytes = [];
  for (let i = 0; i < hash.length; i += 2) {
    bytes.push(parseInt(hash.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Generate a color from a numeric seed
 */
function generateColor(seed, derivation) {
  const method = derivation.method || 'hsl';
  
  if (method === 'hsl') {
    const hue = (seed % 360);
    const saturation = derivation.saturation_range?.[0] + 
      (seed % (derivation.saturation_range?.[1] - derivation.saturation_range?.[0] || 50));
    const lightness = derivation.lightness_range?.[0] + 
      (seed % (derivation.lightness_range?.[1] - derivation.lightness_range?.[0] || 20));
    
    return {
      hsl: { h: hue, s: saturation, l: lightness },
      hex: hslToHex(hue, saturation, lightness)
    };
  }
  
  // Default to hex generation
  const r = (seed >> 8) % 256;
  const g = (seed >> 4) % 256;
  const b = seed % 256;
  
  return {
    hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  };
}

/**
 * Convert HSL to HEX
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Update the UI with accent colors - Enhanced live display
 */
function updateColorDisplay(colors) {
  const colorIds = ['primary', 'secondary', 'tertiary'];
  
  // Get all swatches and add updating class
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.classList.add('updating');
    swatch.classList.add('pulse');
  });
  
  // Update main color displays
  colors.forEach((color, index) => {
    if (index < colorIds.length) {
      const prefix = colorIds[index];
      const colorBox = document.getElementById(`${prefix}-color`);
      const hexEl = document.getElementById(`${prefix}-hex`);
      
      if (colorBox && hexEl) {
        // Apply color with slight delay for staggered effect
        setTimeout(() => {
          colorBox.style.backgroundColor = color.hex;
          colorBox.setAttribute('aria-label', `${colorIds[index]} color: ${color.hex.toUpperCase()}`);
          hexEl.textContent = color.hex.toUpperCase();
          
          // Add click-to-copy handler
          colorBox.onclick = async () => {
            const copied = await copyToClipboard(color.hex.toUpperCase());
            if (copied) showCopyFeedback(colorBox);
          };
          hexEl.onclick = async () => {
            const copied = await copyToClipboard(color.hex.toUpperCase());
            if (copied) showCopyFeedback(hexEl);
          };
          
          // Mark this swatch as primary if it's the first one
          const swatch = colorBox.closest('.color-swatch');
          if (index === 0) {
            swatch.classList.add('primary');
          } else {
            swatch.classList.remove('primary');
          }
        }, index * 100);
      }
    }
  });
  
  // Update accent color (index 0 is primary, we use a derived accent)
  const accentColorBox = document.getElementById('accent-color');
  const accentHex = document.getElementById('accent-hex');
  if (accentColorBox && colors[1]) {
    setTimeout(() => {
      accentColorBox.style.backgroundColor = colors[1].hex;
      accentColorBox.setAttribute('aria-label', `Accent color: ${colors[1].hex.toUpperCase()}`);
      if (accentHex) accentHex.textContent = colors[1].hex.toUpperCase();
      
      // Add click-to-copy for accent
      accentColorBox.onclick = async () => {
        const copied = await copyToClipboard(colors[1].hex.toUpperCase());
        if (copied) showCopyFeedback(accentColorBox);
      };
      accentHex.onclick = async () => {
        const copied = await copyToClipboard(colors[1].hex.toUpperCase());
        if (copied) showCopyFeedback(accentHex);
      };
    }, 200);
  }
  
  // Update palette grid with all colors
  const paletteEl = document.getElementById('palette');
  if (paletteEl) {
    paletteEl.innerHTML = '';
    colors.forEach((color, idx) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch palette-swatch';
      swatch.style.backgroundColor = color.hex;
      
      const label = document.createElement('span');
      label.className = 'palette-label';
      label.textContent = color.hex.toUpperCase();
      swatch.appendChild(label);
      
      swatch.title = `Color ${idx + 1}: ${color.hex.toUpperCase()} (click to copy)`;
      
      // Add click-to-copy for palette swatches
      swatch.onclick = async () => {
        const copied = await copyToClipboard(color.hex.toUpperCase());
        if (copied) showCopyFeedback(swatch);
      };
      
      paletteEl.appendChild(swatch);
    });
  }
  
  // Remove updating class after animations complete
  setTimeout(() => {
    swatches.forEach(swatch => {
      swatch.classList.remove('updating');
      swatch.classList.remove('pulse');
    });
  }, colors.length * 100 + 500);
  
  // Apply primary color to accents
  if (colors[0]) {
    document.documentElement.style.setProperty('--accent-default', colors[0].hex);
    
    // Update header with accent color
    document.documentElement.style.setProperty('--header-accent', colors[0].hex);
  }
  
  // Update timestamp
  const timestampEl = document.getElementById('last-updated');
  if (timestampEl) {
    timestampEl.textContent = new Date().toLocaleTimeString();
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
  }
}

/**
 * Toggle auto-refresh
 */
function toggleAutoRefresh(intervalMinutes = 5) {
  const btn = document.getElementById('auto-refresh-btn');
  
  if (autoRefreshInterval) {
    // Stop auto-refresh
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    if (btn) {
      btn.textContent = 'Auto Refresh: Off';
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
    showStatus('Auto-refresh disabled', 'info');
  } else {
    // Start auto-refresh
    const intervalMs = intervalMinutes * 60 * 1000;
    autoRefreshInterval = setInterval(() => {
      console.log('[Auto-refresh] Refreshing colors...');
      refreshColors();
    }, intervalMs);
    
    if (btn) {
      btn.textContent = `Auto Refresh: On (${intervalMinutes}m)`;
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    }
    showStatus(`Auto-refresh enabled (every ${intervalMinutes} min)`, 'success');
  }
}

/**
 * Main refresh function
 */
async function refreshColors() {
  if (!config) {
    await loadConfig();
  }
  
  if (!config) return;
  
  const hash = await fetchBlockchainHash();
  
  if (hash) {
    const colors = deriveAccentsFromHash(hash);
    updateColorDisplay(colors);
    showStatus(`Updated at ${new Date().toLocaleTimeString()}`, 'success');
  }
}

/**
 * Initialize
 */
function init() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshColors);
  }
  
  // Add auto-refresh button if not exists
  let autoBtn = document.getElementById('auto-refresh-btn');
  if (!autoBtn) {
    autoBtn = document.createElement('button');
    autoBtn.id = 'auto-refresh-btn';
    autoBtn.textContent = 'Auto Refresh: Off';
    autoBtn.className = 'secondary-btn';
    
    const controls = document.getElementById('controls');
    if (controls) {
      const statusMsg = document.getElementById('status-message');
      controls.insertBefore(autoBtn, statusMsg);
    }
    
    autoBtn.addEventListener('click', () => toggleAutoRefresh(5));
  }
  
  // Initial load
  loadConfig().then(() => {
    refreshColors();
  });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
