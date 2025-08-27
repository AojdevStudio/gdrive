#!/bin/bash
# More targeted fix for ESM/CommonJS compatibility issues

set -euo pipefail

echo "🔧 Applying targeted fixes to GitHub Actions workflows..."

# Fix file extensions in workflow patterns but not actual filenames
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/package\*\.mjson/package*.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/tsconfig\.mjson/tsconfig.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/package\.mjson/package.json/g' {} \;

# Fix step names
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/Setup Node\.mjs/Setup Node.js/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/Validate package\.mjson/Validate package.json/g' {} \;

# Fix file paths in commands - revert these to .json
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/gcp-oauth\.keys\.mjson/gcp-oauth.keys.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/gdrive-server-credentials\.mjson/.gdrive-server-credentials.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/test-credentials\.mjson/test-credentials.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/test-oauth\.mjson/test-oauth.json/g' {} \;

# Fix Docker index references
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/node dist\/index\.mjs/node dist\/index.js/g' {} \;

# Fix JSON file extensions in paths but keep .mjs for script files
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/health-check-config\.mjson/health-check-config.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/health-results-\${{ matrix\.environment }}\.mjson/health-results-${{ matrix.environment }}.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/performance-results\.mjson/performance-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/log-analysis-results\.mjson/log-analysis-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/metrics-results\.mjson/metrics-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/baseline-results\.mjson/baseline-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/memory-report\.mjson/memory-report.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-analysis\.mjson/load-test-analysis.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/performance-comparison\.mjson/performance-comparison.json/g' {} \;

# Fix artifact paths with correct extensions
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/health-results-\*\.mjson/health-results-*.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/baseline-results\.mjson/baseline-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/memory-report\.mjson/memory-report.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-\*\.mjson/load-test-*.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/performance-results\.mjson/performance-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/log-analysis-results\.mjson/log-analysis-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/metrics-results\.mjson/metrics-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/performance-comparison\.mjson/performance-comparison.json/g' {} \;

# Fix references to load test files
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-sustained\.mjson/load-test-sustained.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-burst\.mjson/load-test-burst.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-ramp-\$connections\.mjson/load-test-ramp-$connections.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/load-test-ramp-\${conn}\.mjson/load-test-ramp-${conn}.json/g' {} \;

# Fix SBOM path
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/sbom\.spdx\.mjson/sbom.spdx.json/g' {} \;

# Fix JSON parsing in baseline script
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/baseline-results\/baseline-results\.mjson/baseline-results\/baseline-results.json/g' {} \;
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/current-results\/baseline-results\.mjson/current-results\/baseline-results.json/g' {} \;

# Fix include patterns in grep
find .github/workflows -name "*.yml" -type f -exec sed -i.bak 's/--include="\*\.mjs"/--include="*.js"/g' {} \;

# Remove backup files
find .github/workflows -name "*.bak" -delete

echo "✅ Targeted fixes completed!"
echo ""
echo "📝 Changes made:"
echo "- Fixed file references to use correct .json extensions for data files"
echo "- Kept .mjs extensions for executable scripts (ESM compatible)"
echo "- Fixed step names and Docker references"
echo "- Preserved ES module import statements in script files"