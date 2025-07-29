---
allowed-tools: Bash, Grep, Read, WebFetch, mcp__zen__analyze, mcp__zen__codereview
description: Pure analysis PR review for adoption decisions without code modification
---

# PR Review

Analyze pull requests for adoption decisions without code modification. Identify target PR from $ARGUMENTS (number/branch/current), gather PR metadata via gh commands, run automated quality and security assessments, perform deep code review using mcp__zen__codereview and mcp__zen__analyze tools, evaluate technical and business risks, generate scored adoption recommendation (approve/conditional/request changes/reject), and present comprehensive findings to console.
