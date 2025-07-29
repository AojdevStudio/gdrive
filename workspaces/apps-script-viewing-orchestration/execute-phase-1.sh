#!/bin/bash
# Execute Phase 1 Agents in Parallel

echo "Starting Phase 1: Initial Setup & Analysis"
echo "========================================="

# Create git worktrees for each agent
echo "Creating agent worktrees..."
git worktree add workspaces/apps-script-oauth-agent -b feature/apps-script-oauth
git worktree add workspaces/apps-script-types-agent -b feature/apps-script-types  
git worktree add workspaces/apps-script-research-agent -b feature/apps-script-research

echo ""
echo "Phase 1 agents are ready to execute in parallel:"
echo ""
echo "1. OAuth Agent: /task workspaces/apps-script-oauth-agent"
echo "   - Add Apps Script OAuth scope"
echo "   - Test authentication flow"
echo ""
echo "2. Types Agent: /task workspaces/apps-script-types-agent"
echo "   - Create TypeScript interfaces"
echo "   - Define error types"
echo ""
echo "3. Research Agent: /task workspaces/apps-script-research-agent"
echo "   - Document API requirements"
echo "   - Create integration guide"
echo ""
echo "Monitor progress with: /agent-status phase_1"
echo "Commit completed work with: /agent-commit workspaces/[agent-name]"