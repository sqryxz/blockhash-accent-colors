/**
 * main.js - BlockHash Accent Colors Orchestrator
 * Coordinates the fetch → parse → derive → display pipeline
 * Includes comprehensive error handling and retry support
 */

// Pipeline error handling configuration
const PIPELINE_CONFIG = {
  maxRetries: 2,
  retryableErrors: ['Failed to fetch', 'Network error', 'timeout'],
  stepTimeoutMs: 60000
};

// Pipeline error class for detailed error tracking
class PipelineError extends Error {
  constructor(message, step, originalError = null) {
    super(message);
    this.name = 'PipelineError';
    this.step = step;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

// Import modules (assumes module support or direct script loading)
const fetchBlockchain = {
  loadConfig: null,
  fetchLatestBlockHash: null,
  fetchBlockByHash: null,
  fetchNetworkInfo: null,
  RETRY_CONFIG: null
};

const parseLedger = {
  loadConfig: null,
  parseBlockHash: null,
  parseBlockArray: null,
  normalizeHash: null,
  extractBlockMetadata: null,
  parseLedger: null
};

const deriveColors = {
  loadConfig: null,
  sha256: null,
  hexToHsl: null,
  hslToCss: null,
  hslToHex: null,
  deriveColors: null,
  generateCssVariables: null
};

const publish = {
  loadConfig: null,
  generateCssVariables: null,
  generateJsonOutput: null,
  generateHtmlPreview: null,
  publishToFile: null,
  publishForBrowser: null,
  publish: null
};

/**
 * Initialize all module imports
 */
async function initModules() {
  try {
    // Load fetchBlockchain module
    const fbModule = await import('./fetchBlockchain.js');
    Object.assign(fetchBlockchain, fbModule);
    
    // Load parseLedger module  
    const plModule = await import('./parseLedger.js');
    Object.assign(parseLedger, plModule);
    
    // Load deriveColors module
    const dcModule = await import('./deriveColors.js');
    Object.assign(deriveColors, dcModule);
    
    // Load publish module
    const pubModule = await import('./publish.js');
    Object.assign(publish, pubModule);
    
    console.log('[main] Modules initialized successfully');
    return true;
  } catch (error) {
    console.error('[main] Failed to initialize modules:', error);
    return false;
  }
}

/**
 * Main orchestration function - fetch, parse, derive, display
 */
async function runPipeline() {
  console.log('[main] Starting pipeline...');
  const startTime = Date.now();
  
  // Initialize modules
  const modulesLoaded = await initModules();
  if (!modulesLoaded) {
    throw new Error('Failed to load modules');
  }
  
  // Step 1: Fetch latest block hash
  console.log('[main] Step 1: Fetching latest block hash...');
  const rawHash = await fetchBlockchain.fetchLatestBlockHash();
  
  if (!rawHash) {
    throw new Error('Failed to fetch latest block hash');
  }
  
  console.log('[main] Raw hash:', rawHash);
  
  // Step 2: Parse the hash
  console.log('[main] Step 2: Parsing ledger data...');
  const parsedData = await parseLedger.parseLedger({ hash: rawHash });
  
  if (!parsedData || !parsedData.hash) {
    throw new Error('Failed to parse block hash');
  }
  
  console.log('[main] Parsed hash:', parsedData.hash.substring(0, 16) + '...');
  
  // Step 3: Derive colors from hash
  console.log('[main] Step 3: Deriving colors...');
  const colorData = await deriveColors.deriveColors(parsedData);
  
  if (!colorData || !colorData.palette || colorData.palette.length === 0) {
    throw new Error('Failed to derive colors');
  }
  
  console.log('[main] Derived', colorData.palette.length, 'colors');
  
  // Step 4: Generate CSS variables
  const cssVars = deriveColors.generateCssVariables(colorData);
  console.log('[main] CSS variables generated');
  
  // Step 5: Publish to output files (Node.js) or prepare for browser
  console.log('[main] Step 5: Publishing output...');
  let publishResult = null;
  try {
    // Check if we're in Node.js environment for file publishing
    if (typeof window === 'undefined' && typeof process === 'object') {
      publishResult = await publish.publish(colorData, { outputDir: 'public' });
      console.log('[main] Published to files:', publishResult.outputs.map(o => o.type).join(', '));
    } else {
      // Browser: prepare CSS for embedding
      const browserCss = publish.publishForBrowser(colorData, 'css');
      const browserJson = publish.publishForBrowser(colorData, 'json');
      publishResult = { success: true, format: 'browser', css: browserCss, json: browserJson };
      console.log('[main] Published for browser embedding');
    }
  } catch (pubError) {
    console.error('[main] Publish step failed:', pubError);
    // Continue pipeline even if publish fails
    publishResult = { success: false, error: pubError.message };
  }
  
  // Step 6: Update the UI
  await updateDisplay(colorData, cssVars, parsedData.metadata);
  
  const elapsed = Date.now() - startTime;
  console.log(`[main] Pipeline complete in ${elapsed}ms`);
  
  return {
    success: true,
    hash: parsedData.hash,
    colors: colorData.palette,
    primary: colorData.primaryColor,
    accent: colorData.accentColor,
    metadata: parsedData.metadata,
    publish: publishResult,
    elapsedMs: elapsed
  };
}

/**
 * Update the UI with derived colors
 * @param {object} colorData - Color derivation result
 * @param {string} cssVars - Generated CSS variables
 * @param {object} metadata - Block metadata
 */
async function updateDisplay(colorData, cssVars, metadata) {
  // Apply CSS variables to document
  const style = document.createElement('style');
  style.id = 'generated-colors';
  style.textContent = `:root {\n  ${cssVars}\n}`;
  
  // Remove existing generated styles
  const existing = document.getElementById('generated-colors');
  if (existing) {
    existing.remove();
  }
  document.head.appendChild(style);
  
  // Update primary color display
  const primaryColorEl = document.getElementById('primary-color');
  if (primaryColorEl && colorData.primaryColor) {
    primaryColorEl.style.backgroundColor = colorData.primaryColor.hex;
    primaryColorEl.textContent = colorData.primaryColor.hex.toUpperCase();
  }
  
  // Update accent color display
  const accentColorEl = document.getElementById('accent-color');
  if (accentColorEl && colorData.accentColor) {
    accentColorEl.style.backgroundColor = colorData.accentColor.hex;
    accentColorEl.textContent = colorData.accentColor.hex.toUpperCase();
  }
  
  // Update palette display
  const paletteEl = document.getElementById('palette');
  if (paletteEl && colorData.palette) {
    paletteEl.innerHTML = '';
    colorData.palette.forEach((color, idx) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color.hex;
      swatch.title = `Color ${idx + 1}: ${color.hex.toUpperCase()}`;
      swatch.textContent = color.hex.substring(0, 6).toUpperCase();
      paletteEl.appendChild(swatch);
    });
  }
  
  // Update hash display
  const hashEl = document.getElementById('block-hash');
  if (hashEl) {
    hashEl.textContent = colorData.hash;
  }
  
  // Update metadata display
  if (metadata) {
    const heightEl = document.getElementById('block-height');
    if (heightEl && metadata.height) {
      heightEl.textContent = metadata.height.toLocaleString();
    }
    
    const txEl = document.getElementById('tx-count');
    if (txEl && metadata.txCount) {
      txEl.textContent = metadata.txCount.toLocaleString();
    }
  }
  
  // Update timestamp
  const timestampEl = document.getElementById('last-updated');
  if (timestampEl) {
    timestampEl.textContent = new Date().toLocaleString();
  }
}

/**
 * Get current pipeline status
 * @returns {object} Status information
 */
function getStatus() {
  return {
    lastRun: document.getElementById('last-updated')?.textContent || null,
    hash: document.getElementById('block-hash')?.textContent || null,
    primaryColor: document.getElementById('primary-color')?.textContent || null
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initModules,
    runPipeline,
    updateDisplay,
    getStatus
  };
}

// Auto-run if in browser and DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const runBtn = document.getElementById('run-pipeline');
    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        try {
          runBtn.disabled = true;
          runBtn.textContent = 'Running...';
          await runPipeline();
        } catch (error) {
          console.error('[main] Pipeline error:', error);
          alert('Pipeline failed: ' + error.message);
        } finally {
          runBtn.disabled = false;
          runBtn.textContent = 'Run Pipeline';
        }
      });
    }
    
    // Auto-run on load (optional - comment out if not desired)
    // await runPipeline();
  });
}

/**
 * Safe pipeline runner with error handling and retry logic
 * @param {object} options - Options for safe execution
 * @returns {Promise<object>} Pipeline result or error info
 */
async function runPipelineSafe(options = {}) {
  const {
    retries = PIPELINE_CONFIG.maxRetries,
    onStepComplete = null,
    onError = null
  } = options;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[runPipelineSafe] Retry attempt ${attempt}/${retries}`);
      }
      
      const result = await runPipeline();
      
      if (onStepComplete) {
        onStepComplete({ attempt, result });
      }
      
      return {
        success: true,
        attempt: attempt + 1,
        ...result
      };
      
    } catch (error) {
      lastError = error;
      console.error(`[runPipelineSafe] Attempt ${attempt + 1} failed:`, error.message);
      
      if (onError) {
        onError({ attempt: attempt + 1, error });
      }
      
      // Check if error is retryable
      const isRetryable = PIPELINE_CONFIG.retryableErrors.some(
        retryable => error.message?.includes(retryable) || error.message?.includes(retryable)
      );
      
      if (!isRetryable || attempt >= retries) {
        break;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return {
    success: false,
    attempts: retries + 1,
    error: lastError?.message || 'Unknown error',
    errorType: lastError?.name || 'Error',
    step: lastError?.step || 'unknown'
  };
}

/**
 * Get detailed pipeline status
 * @returns {object} Detailed status information
 */
function getDetailedStatus() {
  const basicStatus = getStatus();
  return {
    ...basicStatus,
    timestamp: new Date().toISOString(),
    pipelineConfig: PIPELINE_CONFIG,
    retryConfig: fetchBlockchain.RETRY_CONFIG
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initModules,
    runPipeline,
    runPipelineSafe,
    updateDisplay,
    getStatus,
    getDetailedStatus,
    PipelineError,
    PIPELINE_CONFIG
  };
}
