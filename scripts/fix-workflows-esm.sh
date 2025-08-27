#!/bin/bash
# Fix ESM/CommonJS compatibility issues in GitHub Actions workflows

set -euo pipefail

echo "🔧 Fixing ESM/CommonJS compatibility issues in GitHub Actions workflows..."

# Fix all JavaScript inline scripts to use ES modules
find .github/workflows -name "*.yml" -type f | while read -r workflow; do
    echo "Processing $workflow..."
    
    # Convert require() calls to import statements in heredocs
    sed -i.bak 's/const fs = require('\''fs'\'');/import fs from '\''fs'\'';/g' "$workflow"
    sed -i.bak 's/const https = require('\''https'\'');/import https from '\''https'\'';/g' "$workflow"
    sed -i.bak 's/const http = require('\''http'\'');/import http from '\''http'\'';/g' "$workflow"
    sed -i.bak 's/const path = require('\''path'\'');/import path from '\''path'\'';/g' "$workflow"
    sed -i.bak 's/const { performance } = require('\''perf_hooks'\'');/import { performance } from '\''perf_hooks'\'';/g' "$workflow"
    sed -i.bak 's/const net = require('\''net'\'');/import net from '\''net'\'';/g' "$workflow"
    
    # Fix readFileSync calls
    sed -i.bak 's/JSON\.parse(require('\''fs'\'')\.readFileSync(/JSON.parse(fs.readFileSync(/g' "$workflow"
    sed -i.bak 's/require('\''fs'\'')\.writeFileSync(/fs.writeFileSync(/g' "$workflow"
    sed -i.bak 's/require('\''fs'\'')\.readFileSync(/fs.readFileSync(/g' "$workflow"
    
    # Change .js files to .mjs files in heredocs
    sed -i.bak 's/\.js << '\''EOF'\''/\.mjs << '\''EOF'\''/g' "$workflow"
    sed -i.bak 's/node [a-zA-Z0-9_-]*\.js/node &/g; s/\.js/\.mjs/g' "$workflow"
    
    # Fix package.json requires with jq
    sed -i.bak 's/require('\''\.\/package\.json'\'')\.version/$(jq -r '\''.version'\'' package.json)/g' "$workflow"
    sed -i.bak 's/require('\''\.\/package\.json'\'')/$(jq '\''.\'\'' package.json)/g' "$workflow"
    
    # Fix fs require in github-script actions
    sed -i.bak 's/const fs = require('\''fs'\'');/const fs = await import('\''fs'\'');/g' "$workflow"
    
    # Clean up backup files
    rm -f "$workflow".bak
    
    echo "✅ Fixed $workflow"
done

echo "🎉 ESM/CommonJS fixes completed!"
echo ""
echo "📝 Summary of changes made:"
echo "- Converted require() calls to ES module imports"
echo "- Changed .js files to .mjs files for inline scripts"
echo "- Fixed fs module usage"
echo "- Replaced package.json require() with jq parsing"
echo "- Updated GitHub Actions inline scripts to use ES modules"
echo ""
echo "⚠️  Please review the changes and test the workflows!"