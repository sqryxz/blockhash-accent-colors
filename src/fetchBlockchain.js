/**
 * fetchBlockchain.js - Blockchain Data Fetcher Module
 * Fetches blockchain ledger data from configured network
 * Includes error handling and retry logic
 */

const CONFIG_PATH = '../inputs/config.json';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

let config = null;

/**
 * Sleep utility for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay calculation
 */
function getBackoffDelay(attempt) {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Fetch with retry logic
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} attempt - Current attempt number (internal)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options = {}, attempt = 0) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || (typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(30000) : undefined)
    });
    
    // Retry on server errors (5xx)
    if (response.status >= 500 && attempt < RETRY_CONFIG.maxRetries) {
      const delay = getBackoffDelay(attempt);
      console.warn(`[fetchWithRetry] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }
    
    return response;
    
  } catch (error) {
    // Retry on network errors
    if (attempt < RETRY_CONFIG.maxRetries) {
      const delay = getBackoffDelay(attempt);
      console.warn(`[fetchWithRetry] Network error: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`);
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw error;
  }
}

/**
 * Load configuration from inputs/config.json
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
    console.error('[fetchBlockchain] Failed to load config:', error);
    throw error;
  }
}

/**
 * Get the current/latest block hash from the blockchain
 * @returns {Promise<string|null>} The latest block hash or null on failure
 */
async function fetchLatestBlockHash() {
  const cfg = await loadConfig();
  const bc = cfg.blockchain;
  
  const url = `${bc.rpcUrl}${bc.latestBlockEndpoint}`;
  
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        if (response.status >= 500 && attempt < RETRY_CONFIG.maxRetries) {
          const delay = getBackoffDelay(attempt);
          console.warn(`[fetchLatestBlockHash] ${error.message}, retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
      
      const data = await response.json();
      
      // Handle different API response formats
      let hash = null;
      
      if (Array.isArray(data) && data.length > 0) {
        // Blockstream /blocks returns array of blocks
        // Get the first (latest) block
        hash = data[0].id || data[0].hash || data[0];
      } else if (data.block?.hash) {
        hash = data.block.hash;
      } else if (data.hash) {
        hash = data.hash;
      }
      
      console.log('[fetchLatestBlockHash] Latest hash:', hash);
      return hash;
      
    } catch (error) {
      lastError = error;
      console.error(`[fetchLatestBlockHash] Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`Failed to fetch latest block hash after ${RETRY_CONFIG.maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Get block details by hash
 * @param {string} hash - Block hash
 * @returns {Promise<object|null>} Block details or null
 */
async function fetchBlockByHash(hash) {
  const cfg = await loadConfig();
  const bc = cfg.blockchain;
  
  const url = `${bc.rpcUrl}/block/${hash}`;
  
  try {
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[fetchBlockByHash] Fetch block error:', error);
    return null;
  }
}

/**
 * Get blockchain network info
 * @returns {Promise<object|null>} Network info
 */
async function fetchNetworkInfo() {
  const cfg = await loadConfig();
  const bc = cfg.blockchain;
  
  const url = `${bc.rpcUrl}/network`;
  
  try {
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[fetchNetworkInfo] Network info error:', error);
    return null;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadConfig,
    fetchLatestBlockHash,
    fetchBlockByHash,
    fetchNetworkInfo,
    fetchWithRetry,
    RETRY_CONFIG
  };
}

// ES Module export
export {
  loadConfig,
  fetchLatestBlockHash,
  fetchBlockByHash,
  fetchNetworkInfo,
  fetchWithRetry,
  RETRY_CONFIG
};
