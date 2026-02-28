#!/usr/bin/env node
/**
 * Cron Runner for BlockHashAccentColorsSite
 * 
 * This script is designed to be run by cron to periodically:
 * 1. Fetch the latest block hash from the blockchain
 * 2. Parse the hash into ledger data
 * 3. Derive accent colors
 * 4. Publish output files
 * 
 * Usage:
 *   node src/cron_runner.js
 * 
 * Cron example (every hour):
 *   0 * * * * cd /path/to/blockhash && node src/cron_runner.js >> logs/cron.log 2>&1
 * 
 * Environment variables:
 *   BLOCKHASH_OUTPUT_DIR - Override output directory (default: public)
 *   BLOCKHASH_LOG_FILE   - Log file path (default: logs/cron.log)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = process.env.BLOCKHASH_OUTPUT_DIR || 'public';
const LOG_DIR = process.env.BLOCKHASH_LOG_DIR || 'logs';
const LOG_FILE = process.env.BLOCKHASH_LOG_FILE || path.join(LOG_DIR, 'cron.log');

// Ensure log directory exists
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error(`[cron] Warning: Could not create log directory: ${err.message}`);
  }
}

// Logging function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Console output
  console.log(logMessage);
  
  // File output
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error(`[cron] Warning: Could not write to log file: ${err.message}`);
  }
}

// Run the pipeline
async function runPipeline() {
  const startTime = Date.now();
  log('Starting BlockHash color derivation pipeline');
  
  try {
    // Step 1: Fetch latest block hash
    log('Step 1: Fetching latest block hash...');
    const fetchBlockchain = await import('./fetchBlockchain.js');
    const rawHash = await fetchBlockchain.fetchLatestBlockHash();
    
    if (!rawHash) {
      throw new Error('Could not fetch block hash');
    }
    
    log(`  Got hash: ${rawHash}`);
    
    // Step 2: Parse the hash
    log('Step 2: Parsing ledger data...');
    const parseLedgerModule = await import('./parseLedger.js');
    const parsedData = await parseLedgerModule.parseLedger({ hash: rawHash });
    
    if (!parsedData || !parsedData.hash) {
      throw new Error('Could not parse block hash');
    }
    
    log(`  Parsed hash length: ${parsedData.hash.length}`);
    
    // Step 3: Derive colors
    log('Step 3: Deriving colors...');
    const deriveColorsModule = await import('./deriveColors.js');
    const colorData = await deriveColorsModule.deriveColors(parsedData);
    
    if (!colorData || !colorData.palette || colorData.palette.length === 0) {
      throw new Error('Could not derive colors');
    }
    
    log(`  Derived ${colorData.palette.length} colors`);
    log(`  Primary: ${colorData.primaryColor?.hex}`);
    log(`  Accent: ${colorData.accentColor?.hex}`);
    
    // Step 4: Publish output files
    log('Step 4: Publishing output files...');
    const publishModule = await import('./publish.js');
    const publishResult = await publishModule.publish(colorData, { outputDir: OUTPUT_DIR });
    
    if (!publishResult || !publishResult.success) {
      throw new Error(`Publish failed: ${publishResult?.errors?.join(', ')}`);
    }
    
    log(`  Published ${publishResult.outputs.length} files:`);
    publishResult.outputs.forEach(out => {
      log(`    - ${out.type}: ${out.path}`);
    });
    
    // Success!
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`Pipeline completed successfully in ${duration}s`);
    log(`Primary color: ${colorData.primaryColor?.hex}`);
    log(`Accent color: ${colorData.accentColor?.hex}`);
    log(`Block hash: ${rawHash}`);
    
    return {
      success: true,
      hash: rawHash,
      primaryColor: colorData.primaryColor?.hex,
      accentColor: colorData.accentColor?.hex,
      palette: colorData.palette.map(c => c.hex),
      duration: parseFloat(duration),
      outputs: publishResult.outputs
    };
    
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`Pipeline failed after ${duration}s: ${err.message}`, 'ERROR');
    log(err.stack || '', 'ERROR');
    
    return {
      success: false,
      error: err.message,
      duration: parseFloat(duration)
    };
  }
}

// Main execution
async function main() {
  ensureLogDir();
  
  log('========================================');
  log('BlockHash Cron Runner v1.0.0');
  log('========================================');
  
  const result = await runPipeline();
  
  log('========================================');
  
  // Exit with appropriate code
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run if executed directly
main().catch(err => {
  log(`Fatal error: ${err.message}`, 'ERROR');
  process.exit(1);
});
