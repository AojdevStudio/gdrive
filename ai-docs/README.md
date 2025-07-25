# AI Documentation Reference Library

**YAML-formatted reference documentation for Claude Code custom commands**

---

## Purpose

This directory contains YAML-formatted reference documentation that custom Claude Code commands use as their knowledge base. When you run commands like `/init-protocol`, `/orchestrate`, or `/agent-start`, they reference these YAML files to understand concepts, patterns, and implementations.

Think of these files as the "instruction manuals" that commands consult to perform their tasks correctly.

---

## 📚 Reference Documentation

### Command Support Documents

#### 🧠 **cognitive-os-claude-code.yaml**

Referenced by: Multiple commands  
Purpose: Provides the cognitive framework and reasoning patterns that commands use to make intelligent decisions about code analysis, task decomposition, and workflow orchestration.

#### 📋 **CLAUDE-protocol-template.yaml**

Referenced by: `/init-protocol`  
Purpose: Contains the master template structure for generating project-specific CLAUDE.md files. The init-protocol command uses this to analyze projects and create customized AI protocols.

#### 📝 **custom-command-template.yaml**

Referenced by: `/create-command`, command validation hooks  
Purpose: Defines the standard structure for custom commands. Used as validation reference to ensure new commands follow consistent patterns.

### Workflow References

#### 🔄 **common-workflows.yaml**

Referenced by: `/orchestrate`, `/agent-start`  
Purpose: Catalog of standard development workflows that commands can apply. Helps commands understand typical development patterns and best practices.

#### 🛠️ **command-creation-guide.yaml**

Referenced by: `/create-command`  
Purpose: Step-by-step instructions that the create-command tool follows when generating new custom commands.

#### ✨ **create-custom-slash-commands.yaml**

Referenced by: Command generation tools  
Purpose: Implementation patterns and examples that commands use when creating new slash commands.

### Integration References

#### 🎣 **claude-code-hooks-documentation.yaml**

Referenced by: `/rule2hook`, hook-related commands  
Purpose: Complete specification of the Claude Code hook system. Commands reference this to understand hook events, matchers, and implementation patterns.

#### 🐍 **astral-uv-scripting-documentation.yaml**

Referenced by: Hook generation commands, Python-based tools  
Purpose: Documentation for UV package manager integration. Commands use this when generating Python-based hooks or scripts.

#### 📊 **linear-issue-template.yaml**

Referenced by: `/orchestrate`, `/write-linear-issue`  
Purpose: Template structure for processing Linear issues. Commands reference this to understand how to parse and format Linear integration data.

### Development Standards

#### 😊 **emoji-commit-ref.yaml**

Referenced by: `/commit`, git-related commands  
Purpose: Semantic commit message conventions with emoji prefixes. Commands consult this to generate properly formatted commit messages.

#### 📖 **readme-template.yaml**

Referenced by: `/generate-readme`  
Purpose: Variable-based template for generating project documentation. The generate-readme command uses this structure to create comprehensive README files.

#### 🌳 **mastering-git-worktrees.yaml**

Referenced by: `/agent-start`, `/agent-commit`, parallel workflow commands  
Purpose: Advanced git worktree patterns for parallel development. Commands reference this to manage isolated agent workspaces.

---

## 🔧 How Commands Use These References

### Quick Lookup Pattern

Commands use YAML's structured format for fast information retrieval:

```yaml
# Command can directly access:
reference.hook_events.PreToolUse.description
reference.workflow_patterns.parallel_development.steps[0]
```

### Context Injection

Commands include these references via `@` syntax:

```markdown
## Context

- Hook patterns: @ai-docs/claude-code-hooks-documentation.yaml
- Commit formats: @ai-docs/emoji-commit-ref.yaml
```

### Template Processing

Commands use these files as templates with variable substitution:

```yaml
project_name: '{{PROJECT_NAME}}'
workflow_type: '{{SELECTED_WORKFLOW}}'
```

---

## 📋 Reference Categories

### 🏗️ **Framework References**

Files that define core concepts and structures:

- `cognitive-os-claude-code.yaml` - Thinking patterns
- `CLAUDE-protocol-template.yaml` - Protocol structures

### 🔧 **Implementation References**

Files that guide how things should be built:

- `command-creation-guide.yaml` - Command construction
- `claude-code-hooks-documentation.yaml` - Hook implementation
- `astral-uv-scripting-documentation.yaml` - Python integration

### 📐 **Template References**

Files that provide reusable patterns:

- `custom-command-template.yaml` - Command structure
- `readme-template.yaml` - Documentation structure
- `linear-issue-template.yaml` - Issue structure

### 📚 **Standards References**

Files that define conventions and patterns:

- `common-workflows.yaml` - Workflow patterns
- `emoji-commit-ref.yaml` - Commit conventions
- `mastering-git-worktrees.yaml` - Git patterns

---

## 💡 Understanding YAML Benefits for Commands

### Why YAML Format?

1. **Direct Access**: Commands can navigate to specific data without parsing
2. **Type Safety**: Structure enforces consistent data formats
3. **Performance**: Faster lookup than scanning markdown documents
4. **Validation**: Commands can validate against expected structures
5. **Extensibility**: Easy to add new fields without breaking existing commands

### Example: How `/commit` Uses References

```yaml
# From emoji-commit-ref.yaml
commit_types:
  feat:
    emoji: "✨"
    description: "New feature"
  fix:
    emoji: "🐛"
    description: "Bug fix"

# Command directly accesses:
emoji = reference.commit_types.fix.emoji  # Returns "🐛"
```

---

## 🚀 Adding New References

When creating new reference documentation:

1. **Use YAML structure** - Enables programmatic access
2. **Include descriptions** - Help both humans and AI understand
3. **Provide examples** - Show practical usage
4. **Maintain consistency** - Follow existing patterns
5. **Update command contexts** - Add `@ai-docs/your-new-ref.yaml` to relevant commands

---

## 📊 Reference Usage Map

| Command            | Primary References Used                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `/init-protocol`   | CLAUDE-protocol-template.yaml, cognitive-os-claude-code.yaml                 |
| `/orchestrate`     | common-workflows.yaml, linear-issue-template.yaml                            |
| `/agent-start`     | common-workflows.yaml, mastering-git-worktrees.yaml                          |
| `/commit`          | emoji-commit-ref.yaml                                                        |
| `/generate-readme` | readme-template.yaml                                                         |
| `/rule2hook`       | claude-code-hooks-documentation.yaml, astral-uv-scripting-documentation.yaml |
| `/create-command`  | custom-command-template.yaml, command-creation-guide.yaml                    |

---

## 🔄 Maintenance Guidelines

### Updating References

- Changes to these files directly affect command behavior
- Test commands after updating their reference files
- Maintain backward compatibility when possible
- Document breaking changes clearly

### Version Control

- Track all changes to maintain command stability
- Use meaningful commit messages when updating
- Consider impact on dependent commands

---

## 📞 Contributing

To improve these reference documents:

1. Ensure YAML validity
2. Maintain existing structure
3. Add helpful comments
4. Test with dependent commands
5. Submit with clear documentation

---

_These YAML references form the knowledge foundation for Claude Code's custom commands, enabling consistent, intelligent, and context-aware development assistance._
