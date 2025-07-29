---
allowed-tools: mcp__mcp-server-firecrawl__firecrawl_scrape, Write, Bash
description: Scrape websites using Firecrawl MCP and save content to research folders
---

# Scrape Site

This command scrapes websites using the Firecrawl MCP and intelligently saves the content to organized research folders within the desktop-commander documentation system.

$ARGUMENTS

**Usage Examples:**
- `/scrape-site https://docs.anthropic.com/claude/guide` - Scrape and auto-organize in research folder
- `/scrape-site https://example.com/api "api-docs"` - Scrape and save to specific subfolder
- `/scrape-site https://github.com/owner/repo/wiki "github-wiki"` - Save with custom folder name

## Instructions
- Extract the URL from `$ARGUMENTS` (first argument is always the URL to scrape)
- If second argument provided, use it as the subfolder name; otherwise auto-generate from URL domain
- Use Firecrawl MCP to scrape the site with markdown format and main content extraction
- Create organized folder structure in `docs/research/[domain-or-subfolder]/`  
- Generate descriptive filename based on URL path or page title
- Save scraped content as markdown file with metadata header (URL, date, source)
- Create or update an index file in the research folder listing all scraped content
- Provide summary of scraped content and file location

## Context
- Research folder structure: `docs/research/` (organized by domain/topic)
- Existing research: !`ls -la docs/context7-research/ docs/research/ 2>/dev/null | head -10`
- Firecrawl MCP status: Available for web scraping with markdown output
- Current date: !`date "+%Y-%m-%d"`
- Content organization: domain-based folders (anthropic, github, etc.) or custom subfolder names
- File naming: descriptive names based on URL path, avoiding special characters
- Metadata format: YAML frontmatter with url, scraped_date, domain, and title fields