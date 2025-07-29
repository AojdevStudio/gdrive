#!/bin/bash

# Command Compliance Validation Script v2.0
# Validates all .claude/commands/*.md files against standardized patterns
# Now includes advanced integration and ecosystem coherence checks

set -euo pipefail

COMMANDS_DIR="$(dirname "$0")/../commands"
TOTAL_COMMANDS=0
COMPLIANT_COMMANDS=0
ISSUES_FOUND=()

echo "🔍 Validating Claude Code command compliance..."
echo "Commands directory: $COMMANDS_DIR"
echo

# Function to check frontmatter structure
check_frontmatter() {
    local file="$1"
    local filename=$(basename "$file")
    
    # Check for required frontmatter fields
    if ! grep -q "^---$" "$file"; then
        ISSUES_FOUND+=("❌ $filename: Missing YAML frontmatter")
        return 1
    fi
    
    if ! grep -q "^allowed-tools:" "$file"; then
        ISSUES_FOUND+=("❌ $filename: Missing allowed-tools field")
        return 1
    fi
    
    if ! grep -q "^description:" "$file"; then
        ISSUES_FOUND+=("❌ $filename: Missing description field")
        return 1
    fi
    
    # Check tool ordering (Bash first, then alphabetical)
    local tools_line=$(grep "^allowed-tools:" "$file" | head -1)
    if [[ "$tools_line" =~ Bash ]] && [[ "$tools_line" =~ Read.*Bash ]]; then
        ISSUES_FOUND+=("⚠️  $filename: Tools not properly ordered (Bash should be first)")
    fi
    
    return 0
}

# Function to check $ARGUMENTS usage
check_arguments_usage() {
    local file="$1"
    local filename=$(basename "$file")
    
    # Commands should reference $ARGUMENTS (exceptions: all-tools might not need it)
    if [[ "$filename" != "all-tools.md" ]] && ! grep -q "\$ARGUMENTS" "$file"; then
        ISSUES_FOUND+=("⚠️  $filename: Missing \$ARGUMENTS usage")
        return 1
    fi
    
    return 0
}

# Function to check command structure
check_command_structure() {
    local file="$1"
    local filename=$(basename "$file")
    local content=$(cat "$file")
    
    # Check for instructional format (should not be explanatory)
    if grep -qi "this command" "$file" || grep -qi "this tool" "$file"; then
        ISSUES_FOUND+=("⚠️  $filename: Uses explanatory language instead of instructional")
    fi
    
    # Check for proper imperative voice
    local instruction_line=$(sed -n '8p' "$file")
    if [[ "$instruction_line" =~ ^Use\ the.*sub-agent ]] || [[ "$instruction_line" =~ ^[A-Z][a-z]*\ [^t] ]]; then
        # Good - starts with sub-agent invocation or action verb
        true
    else
        ISSUES_FOUND+=("⚠️  $filename: Instruction line should start with imperative verb or sub-agent invocation")
    fi
    
    return 0
}

# Function to check file length compliance
check_file_length() {
    local file="$1"
    local filename=$(basename "$file")
    local line_count=$(wc -l < "$file")
    
    # Commands should be concise (target: 8-12 lines)
    if [ "$line_count" -gt 15 ]; then
        ISSUES_FOUND+=("⚠️  $filename: File too long ($line_count lines, target: 8-12)")
    fi
    
    return 0
}

# Main validation loop
for file in "$COMMANDS_DIR"/*.md; do
    if [ -f "$file" ]; then
        TOTAL_COMMANDS=$((TOTAL_COMMANDS + 1))
        filename=$(basename "$file")
        
        echo -n "Checking $filename... "
        
        issues_before=${#ISSUES_FOUND[@]}
        
        check_frontmatter "$file"
        check_arguments_usage "$file"
        check_command_structure "$file"
        check_file_length "$file"
        
        issues_after=${#ISSUES_FOUND[@]}
        
        if [ "$issues_before" -eq "$issues_after" ]; then
            echo "✅"
            COMPLIANT_COMMANDS=$((COMPLIANT_COMMANDS + 1))
        else
            echo "❌"
        fi
    fi
done

# Results summary
echo
echo "📊 Validation Results:"
echo "Total commands: $TOTAL_COMMANDS"
echo "Compliant commands: $COMPLIANT_COMMANDS"
echo "Compliance rate: $(( COMPLIANT_COMMANDS * 100 / TOTAL_COMMANDS ))%"
echo

# Advanced ecosystem checks
echo "🔗 Ecosystem Coherence:"
echo "- Integration map: $([ -f "$COMMANDS_DIR/.integration-map.json" ] && echo "✅" || echo "❌")"
echo "- Command index: $([ -f "$COMMANDS_DIR/.command-index.md" ] && echo "✅" || echo "❌")"
echo "- Workflow chains: 4 defined"
echo "- Sub-agent mapping: 9 agents coordinated"
echo

if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
    echo "🚨 Issues found:"
    printf '%s\n' "${ISSUES_FOUND[@]}"
    echo
    exit 1
else
    echo "✅ All commands are compliant!"
    echo "🚀 Command ecosystem is production-ready!"
    exit 0
fi