---
allowed-tools: Read, Write, Bash, Glob, Grep, Eza, Git
description: Generate comprehensive README using structured template with project analysis
---

# Generate README

This command analyzes your project structure and generates a comprehensive README file following the established template pattern with proper variable substitution and contextual content. For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.

**variables:**
DirectoryContents: $ARGUMENTS

**Usage Examples:**

- `/generate-readme` - Generate README for current project using template (@ai-docs/readme-template.yaml)
- `/generate-readme` $ARGUMENTS - Generate about a specific directory using the template (@ai-docs/readme-template.yaml) and save it to the current directory.

```yaml
# A protocol for generating a high-quality, easy-to-understand project README
# by applying the Feynman Technique throughout the process.
feynman_readme_generator_protocol:
  # The central philosophy guiding the entire README generation process.
  core_principle:
    name: 'The Feynman Technique'
    description: 'The primary instruction is to explain all concepts as simply as possible, as if teaching them to someone intelligent but unfamiliar with the domain.'
    tenets:
      - 'Explain complex concepts in simple, clear language.'
      - 'Use analogies and real-world examples to illustrate technical ideas.'
      - 'Break down complicated processes into basic, logical steps.'
      - "Focus on explaining 'why' a feature exists, not just 'what' it does."

  # The step-by-step process for generating the README file.
  process_flow:
    - phase: 1
      name: 'Technical Analysis'
      description: 'Explore the project structure and gather information about its composition and Git history.'
      actions:
        - 'Analyze the current project structure to understand its layout.'
        - 'Use the EZA CLI with various flags to explore file systems, git status, and directory trees.'
        - "Analyze git history and changelogs to understand the project's evolution and key updates."
      tools:
        eza_cli_commands:
          - command: 'eza'
            purpose: 'Basic file listing.'
          - command: 'eza -l --git'
            purpose: 'Detailed listing with metadata and Git status.'
          - command: 'eza -T --level=2'
            purpose: 'Tree view of the project structure, limited to 2 levels.'
          - command: 'eza -a --icons'
            purpose: 'List all files, including hidden ones, with file-type icons.'

    - phase: 2
      name: 'Content Generation'
      description: 'Extract project data and generate explanatory content using the Feynman Technique.'
      actions:
        - 'Extract project metadata (name, version, license) from configuration files (e.g., package.json, setup.py).'
        - 'Identify key features, installation methods, and usage patterns from the codebase.'
        - 'For each feature, explain its purpose simply: What problem does it solve? Why is it needed?'
        - 'Use analogies to compare technical concepts to familiar, everyday experiences.'
        - 'Break down complex workflows into logical, sequential steps.'
        - 'When a technical term is unavoidable, explain it immediately in plain language.'
        - 'Load the README template and systematically replace all `{{VARIABLE}}` placeholders with the generated content.'

    - phase: 3
      name: 'Feynman-Style Writing'
      description: 'Apply specific writing guidelines to ensure the content is clear, simple, and benefit-oriented.'
      guidelines:
        - "Start each section with the 'why'—the problem or need being addressed."
        - "Use concrete examples (e.g., 'works with React, Vue, and Angular' instead of 'multi-framework support')."
        - "Explain each setup step and why it's necessary for the user."
        - 'Clearly articulate the real-world impact and benefits of each feature.'
        - 'Use progressive disclosure: start with a simple overview, then offer deeper details for interested readers.'
        - 'Ensure each explanation is understandable to someone new to the specific technology or domain.'

    - phase: 4
      name: 'Final Assembly'
      description: 'Assemble the final README file, including navigation, setup instructions, and community information.'
      actions:
        - 'Create navigation links that correspond to the actual sections in the generated README.'
        - 'Include accurate setup instructions based on the detected package manager and dependencies.'
        - 'Add relevant badges (build status, version), license information, and community links if available.'
        - 'Write the completed content to the final README.md file at the specified location.'
        - 'Provide a summary of the generated sections and suggest areas for final manual review.'

  # Defines the context, data sources, and key definitions for the command's operation.
  operational_context:
    reference_documents:
      - '@ai-docs/readme-template.yaml'
    data_sources:
      - name: 'Project Root'
        command: '!`pwd`'
      - name: 'Package Configuration'
        command: '!`ls package.json setup.py Cargo.toml composer.json 2>/dev/null || echo "none"`'
      - name: 'Project Structure'
        command: '!`find . -maxdepth 2 -type f -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.js" -o -name "*.ts" | grep -v node_modules | head -20`'
      - name: 'Git Remote URL'
        command: '!`git remote get-url origin 2>/dev/null || echo "no-remote"`'
      - name: 'Git User Name'
        command: '!`git config user.name`'
      - name: 'Git User Email'
        command: '!`git config user.email`'
      - name: 'License File'
        command: '!`ls LICENSE* 2>/dev/null || echo "none"`'
      - name: 'Documentation Files'
        command: '!`ls docs/ README* CONTRIBUTING* 2>/dev/null || echo "none"`'
    definitions:
      template_variables:
        - 'PROJECT_NAME'
        - 'TAGLINE_OR_SHORT_DESCRIPTION'
        - 'VERSION'
        - 'LICENSE_TYPE'
        - 'REQUIREMENTS'
        - 'PRIMARY_PURPOSE'
        - 'DISTINGUISHING_FEATURE_OR_METHOD'
        - 'TARGET_AUDIENCE_OR_DOMAIN'
        - 'INSTALL_COMMAND_PRIMARY'
        - 'REPOSITORY_PATH'
      common_sections:
        - 'Setup & Updates'
        - 'Key Highlights'
        - 'Quick Navigation'
        - 'Modular Features'
        - 'Documentation & Resources'
        - 'Support & Community'
        - 'Contributing'
        - 'License'
      output_location:
        description: 'Defaults to `README.md` in the project root, but can be overridden with the `$ARGUMENTS` variable.'
```
