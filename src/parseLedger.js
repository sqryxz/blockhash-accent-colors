/**
 * parseLedger.js - Blockchain Ledger Parser Module
 * Parses blockchain data and extracts hash strings for color derivation
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
    console.error('[parseLedger] Failed to load config:', error);
    throw error;
  }
}

/**
 * Parse raw blockchain block data and extract hash string
 * @param {object} blockData - Raw block data from blockchain API
 * @returns {string|null} The hash string for color derivation, or null
 */
function parseBlockHash(blockData) {
  if (!blockData) return null;
  
  // Handle different API response formats
  // Blockstream format: { id, hash, timestamp, ... }
  let hash = null;
  
  if (typeof blockData === 'string') {
    // Already a hash string
    hash = blockData;
  } else if (blockData.hash) {
    hash = blockData.hash;
  } else if (blockData.id) {
    hash = blockData.id;
  }
  
  // Validate it's a valid hex string (for Bitcoin-style hashes)
  if (hash && /^[a-fA-F0-9]+$/.test(hash)) {
    console.log('[parseLedger] Parsed hash:', hash.substring(0, 16) + '...');
    return hash;
  }
  
  console.warn('[parseLedger] Invalid hash format:', hash);
  return null;
}

/**
 * Parse multiple blocks and extract all hashes
 * @param {Array} blocks - Array of block objects
 * @returns {string[]} Array of valid hash strings
 */
function parseBlockArray(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [];
  }
  
  const hashes = [];
  
  for (const block of blocks) {
    const hash = parseBlockHash(block);
    if (hash) {
      hashes.push(hash);
    }
  }
  
  console.log(`[parseLedger] Parsed ${hashes.length} hashes from ${blocks.length} blocks`);
  return hashes;
}

/**
 * Normalize hash for consistent color derivation
 * Ensures we have a deterministic string input
 * @param {string} hash - Raw hash string
 * @returns {string} Normalized hash string
 */
function normalizeHash(hash) {
  if (!hash) return '';
  
  // Ensure lowercase hex for consistency
  return hash.toLowerCase().replace(/[^a-f0-9]/g, '');
}

/**
 * Extract additional metadata from block for context
 * @param {object} blockData - Raw block data
 * @returns {object} Extracted metadata
 */
function extractBlockMetadata(blockData) {
  if (!blockData || typeof blockData !== 'object') {
    return {};
  }
  
  return {
    height: blockData.height || blockData.block_height || null,
    timestamp: blockData.timestamp || blockData.time || null,
    txCount: blockData.tx?.length || blockData.n_tx || 0,
    size: blockData.size || null
  };
}

/**
 * Main parse function - orchestrates parsing workflow
 * @param {object} rawData - Raw blockchain data (single block or array)
 * @returns {object} Parsed result with hash and metadata
 */
async function parseLedger(rawData) {
  const cfg = await loadConfig();
  
  if (!rawData) {
    console.warn('[parseLedger] No raw data provided');
    return { hash: null, metadata: {}, hashes: [] };
  }
  
  let hash = null;
  let hashes = [];
  let metadata = {};
  
  // Handle array of blocks (from /blocks endpoint)
  if (Array.isArray(rawData)) {
    hashes = parseBlockArray(rawData);
    // Use the first (latest) block for primary hash
    hash = hashes[0] || null;
    if (rawData[0]) {
      metadata = extractBlockMetadata(rawData[0]);
    }
  } else {
    // Single block
    hash = parseBlockHash(rawData);
    hashes = hash ? [hash] : [];
    metadata = extractBlockMetadata(rawData);
  }
  
  const normalizedHash = normalizeHash(hash);
  
  console.log('[parseLedger] Parsed result:', { 
    hash: normalizedHash ? normalizedHash.substring(0, 16) + '...' : null,
    hashCount: hashes.length,
    metadata 
  });
  
  return {
    hash: normalizedHash,
    hashes: hashes.map(normalizeHash),
    metadata,
    algorithm: cfg.colorDerivation?.algorithm || 'sha256'
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadConfig,
    parseBlockHash,
    parseBlockArray,
    normalizeHash,
    extractBlockMetadata,
    parseLedger
  };
}

// ES Module exports
export {
  loadConfig,
  parseBlockHash,
  parseBlockArray,
  normalizeHash,
  extractBlockMetadata,
  parseLedger
};
