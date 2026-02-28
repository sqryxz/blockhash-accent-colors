# BlockHash Accent Colors

Derive accent colors from blockchain ledger hash — a visual representation of the ever-changing blockchain state.

## Overview

This project fetches the latest Bitcoin block hash from the blockchain, parses it, and derives a unique 6-color palette using SHA-256 hashing. Each run produces a fresh color scheme based on the current state of the ledger.

## Features

- **Live Blockchain Data**: Fetches real-time block data from Blockstream's Bitcoin API
- **SHA-256 Color Derivation**: Converts block hash into a deterministic color palette
- **Multiple Output Formats**: CSS variables, JSON data, and HTML preview
- **Browser + Node.js**: Works in both environments
- **Automated Updates**: Ready for cron-based automation

## Installation

```bash
# Clone or navigate to the project directory
cd blockhash

# No external dependencies required (vanilla JS)
```

## Usage

### Browser

Open `src/index.html` in a web browser. The page will:
1. Fetch the latest Bitcoin block hash
2. Derive a 6-color palette
3. Display the colors with hex values

### Node.js / CLI

Run the full pipeline:

```bash
node src/test_pipeline.js
```

This executes:
1. Fetch latest block hash from Bitcoin network
2. Parse and normalize the hash
3. Derive 6-color palette via SHA-256
4. Publish outputs to `public/outputs/`

### Output Files

After running the pipeline, outputs are saved to:

| File | Description |
|------|-------------|
| `public/outputs/css/colors.css` | CSS custom properties |
| `public/outputs/json/colors.json` | Structured JSON data |
| `public/outputs/history/` | Timestamped history of runs |

## Configuration

Edit `inputs/config.json` to customize:

```json
{
  "blockchain": {
    "network": "bitcoin",
    "rpcUrl": "https://blockstream.info/api"
  },
  "colorDerivation": {
    "algorithm": "sha256",
    "paletteSize": 6,
    "saturationRange": [0.6, 0.9],
    "lightnessRange": [0.4, 0.7]
  },
  "updateInterval": 3600000
}
```

### Options

- `paletteSize`: Number of colors to generate (default: 6)
- `saturationRange`: HSL saturation min/max (default: 0.6-0.9)
- `lightnessRange`: HSL lightness min/max (default: 0.4-0.7)
- `updateInterval`: Auto-refresh interval in ms (default: 1 hour)

## Architecture

```
blockhash/
├── src/
│   ├── fetchBlockchain.js   # API client for block data
│   ├── parseLedger.js       # Hash parsing utilities
│   ├── deriveColors.js      # SHA-256 → color palette
│   ├── publish.js           # Output file generation
│   ├── main.js              # Orchestrator
│   └── index.html           # Browser UI
├── inputs/
│   └── config.json          # Configuration
├── public/
│   └── outputs/             # Generated files
│       ├── css/
│       ├── json/
│       └── history/
└── test_pipeline.js         # CLI runner
```

## Automation

### Cron Setup

Add to crontab for hourly updates:

```bash
0 * * * * cd /path/to/blockhash && node src/test_pipeline.js >> /path/to/blockhash/cron.log 2>&1
```

## Example Output

```json
{
  "blockHash": "00000000000000000000118985e6ff66d62ea0e1adbc77b17bb7a9e776d4ae3d",
  "timestamp": "2026-02-28T00:00:00Z",
  "palette": {
    "primary": "#0fbd77",
    "accent": "#bd0f55",
    "colors": ["#0fbd77", "#85ec32", "#6285e4", "#ad931f", "#efa36c", "#37c21e"]
  }
}
```

## License

MIT
