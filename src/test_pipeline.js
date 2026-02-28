/**
 * Test runner for BlockHash fetch→parse→derive→publish pipeline
 * Run with: node src/test_pipeline.js
 */

import('./fetchBlockchain.js')
  .then(async (fetchBlockchain) => {
    console.log('[test] Testing fetch→parse→derive→publish pipeline...\n');
    
    // Step 1: Fetch latest block hash
    console.log('[test] Step 1: Fetching latest block hash...');
    const rawHash = await fetchBlockchain.fetchLatestBlockHash();
    
    if (!rawHash) {
      console.error('[test] FAIL: Could not fetch block hash');
      process.exit(1);
    }
    
    console.log('[test] ✓ Got hash:', rawHash);
    
    // Step 2: Parse the hash
    console.log('\n[test] Step 2: Parsing ledger data...');
    const parseLedgerModule = await import('./parseLedger.js');
    const parsedData = await parseLedgerModule.parseLedger({ hash: rawHash });
    
    if (!parsedData || !parsedData.hash) {
      console.error('[test] FAIL: Could not parse block hash');
      process.exit(1);
    }
    
    console.log('[test] ✓ Parsed hash length:', parsedData.hash.length);
    console.log('[test]   Metadata:', JSON.stringify(parsedData.metadata));
    
    // Step 3: Derive colors
    console.log('\n[test] Step 3: Deriving colors...');
    const deriveColorsModule = await import('./deriveColors.js');
    const colorData = await deriveColorsModule.deriveColors(parsedData);
    
    if (!colorData || !colorData.palette || colorData.palette.length === 0) {
      console.error('[test] FAIL: Could not derive colors');
      process.exit(1);
    }
    
    console.log('[test] ✓ Derived', colorData.palette.length, 'colors');
    console.log('[test] Primary color:', colorData.primaryColor?.hex);
    console.log('[test] Accent color:', colorData.accentColor?.hex);
    
    // Step 4: Generate CSS variables
    const cssVars = deriveColorsModule.generateCssVariables(colorData);
    console.log('\n[test] ✓ Generated CSS variables');
    
    // Step 5: Publish to files
    console.log('\n[test] Step 4: Publishing output files...');
    const publishModule = await import('./publish.js');
    const publishResult = await publishModule.publish(colorData, { outputDir: 'public' });
    
    if (!publishResult || !publishResult.success) {
      console.error('[test] FAIL: Could not publish output:', publishResult?.errors);
      process.exit(1);
    }
    
    console.log('[test] ✓ Published files:');
    publishResult.outputs.forEach(out => {
      console.log(`[test]   - ${out.type}: ${out.path}`);
    });
    
    // Output summary
    console.log('\n========== PIPELINE TEST SUCCESS ==========');
    console.log('Hash:', rawHash);
    console.log('Palette:');
    colorData.palette.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.hex} (${c.css})`);
    });
    console.log('Published:');
    publishResult.outputs.forEach(out => {
      console.log(`  - ${out.type}`);
    });
    console.log('============================================\n');
    
    process.exit(0);
  })
  .catch((err) => {
    console.error('[test] Pipeline test failed:', err);
    process.exit(1);
  });
