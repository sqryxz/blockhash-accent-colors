# Deployment Guide

This document covers deploying BlockHash Accent Colors to various hosting platforms.

## Overview

BlockHash produces static output files that can be hosted anywhere that serves static files:
- `public/outputs/css/colors.css` - CSS variables
- `public/outputs/json/colors.json` - JSON data  
- `public/outputs/history/` - Historical runs
- `src/index.html` - The main UI

## Prerequisites

Before deploying, ensure you've run the pipeline at least once:

```bash
cd blockhash
node src/test_pipeline.js
```

This generates the initial output files in `public/outputs/`.

---

## Deployment Options

### 1. GitHub Pages (Free)

**Best for:** Personal projects, open source

#### Option A: GitHub Actions (Recommended)

1. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  schedule:
    # Run 4 times daily
    - cron: '0 0,6,12,18 * * *'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run pipeline
        run: |
          npm install
          node src/test_pipeline.js
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public/outputs
          publish_branch: gh-pages
```

2. Go to Settings → Pages → Source: Select "gh-pages" branch
3. Enable GitHub Actions in Settings → Actions → General

#### Option B: Manual

```bash
# Build output
node src/test_pipeline.js

# Commit to gh-pages branch
git checkout gh-pages
cp -r public/outputs/* ./src/
git add -A
git commit -m "Update colors"
git push origin gh-pages
git checkout main
```

---

### 2. Netlify (Free Tier)

**Best for:** Quick deployments, custom domains, HTTPS

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Create `netlify.toml`:
```toml
[build]
  command = "node src/test_pipeline.js"
  publish = "public/outputs"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

3. Connect repository in Netlify dashboard
4. Set build command: `node src/test_pipeline.js`
5. Set publish directory: `public/outputs`

**Note:** Add a decision entry before deploying externally (per project policy).

---

### 3. Vercel (Free Tier)

**Best for:** Fast global CDN, serverless functions

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create `vercel.json`:
```json
{
  "buildCommand": "node src/test_pipeline.js",
  "outputDirectory": "public/outputs"
}
```

3. Deploy:
```bash
vercel --prod
```

**Note:** Add a decision entry before deploying externally (per project policy).

---

### 4. Cloudflare Pages (Free)

**Best for:** Fast edge network, privacy-focused

1. Connect GitHub repository in Cloudflare dashboard
2. Build command: `node src/test_pipeline.js`
3. Build output directory: `public/outputs`
4. Add environment variable: `NODE_VERSION = 20`

---

### 5. Self-Hosted (VPS/Dedicated)

**Best for:** Full control, no external dependencies

#### Using Nginx

```bash
# Install nginx
sudo apt install nginx

# Copy files
sudo cp -r blockhash/public/outputs/* /var/www/blockhash/

# Configure nginx
sudo tee /etc/nginx/sites-available/blockhash > /dev/null <<EOF
server {
    listen 80;
    server_name blockhash.yourdomain.com;
    root /var/www/blockhash;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/blockhash /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Using Cron + rsync

```bash
# Add to crontab (run every 6 hours)
0 */6 * * * cd /path/to/blockhash && node src/test_pipeline.js && rsync -avz public/outputs/ user@vps:/var/www/blockhash/
```

---

### 6. Docker (Any Host)

**Best for:** Consistent deployments, any hosting

#### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy source
COPY package.json package-lock.json* ./
COPY src ./src
COPY inputs ./inputs
COPY public ./public
COPY test_pipeline.js ./

# Install deps
RUN npm install

# Build
RUN node test_pipeline.js

# Serve with nginx
FROM nginx:alpine
COPY --from=0 /app/public/outputs /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Build & Run

```bash
docker build -t blockhash .
docker run -d -p 8080:80 blockhash
```

---

## Automated Deployments

### Schedule-Based (Recommended)

The project already has cron automation configured via launchd (macOS) or cron (Linux). To add deployment:

1. **For GitHub Pages:** Use the GitHub Actions workflow above
2. **For other platforms:** Add deploy command to `src/cron_runner.js`

Example extending cron_runner.js:

```javascript
import { execSync } from 'child_process';

// ... existing pipeline code ...

// After publish step, add:
if (process.env.DEPLOY_URL) {
  console.log('Deploying...');
  execSync(`rsync -avz public/outputs/ ${process.env.DEPLOY_URL}`, { 
    stdio: 'inherit' 
  });
}
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DEPLOY_URL` | rsync target for deployment | `user@server:/path` |
| `GITHUB_TOKEN` | GitHub token for Actions | (secret) |
| `NETLIFY_AUTH_TOKEN` | Netlify API token | (secret) |
| `VERCEL_TOKEN` | Vercel API token | (secret) |

---

## Post-Deployment Checklist

- [ ] Run `node src/test_pipeline.js` successfully
- [ ] Verify `public/outputs/` contains files
- [ ] Test in browser: open index.html
- [ ] Check HTTPS is working (if using custom domain)
- [ ] Verify cron schedule is running
- [ ] Check logs for errors

---

## Troubleshooting

### "Module not found" errors
```bash
npm install
```

### Blockstream API rate limits
The API has rate limits. If you hit them:
- Wait 1 hour between runs
- Use a different API endpoint in `inputs/config.json`
- Add your own Bitcoin node RPC

### Colors not updating
- Check `public/outputs/json/colors.json` timestamp
- Verify cron is running: `launchctl list | grep blockhash`
- Check logs: `tail -f blockhash/logs/cron.log`

---

## Security Notes

- **No sensitive data** in this project (public blockchain data only)
- **API keys** not required for Blockstream's public API
- **No database** - all state is in the git history and output files
- **Read-only** - the project only reads from the blockchain

---

## Support

- Check `logs/cron.log` and `logs/cron.error.log` for errors
- Review `agent_state.json` for task status
- See `README.md` for usage details
