# AOJ Workbench

This context defines the language for AOJ Workbench, a self-hosted knowledge-work MCP surface that gives agents one connector for the user's daily-work tools.

## Language

**AOJ Workbench**:
The canonical product name for the self-hosted knowledge-work MCP surface. AOJ Workbench owns the agent-facing interface, policy, routing, aliases, confirmations, and automation behavior.
_Avoid_: Google Workspace MCP, GWS MCP, gdrive MCP, Google Drive MCP, Drive MCP, Gmail MCP

**Composio native provider**:
The default provider layer AOJ Workbench uses to connect to external SaaS tools through the Composio SDK.
_Avoid_: companion MCP, sidecar MCP, optional provider

**Provider toolkit**:
A Composio-backed toolkit for an external service such as Google Workspace, Gmail, Outlook, Notion, Stripe, YouTube, Slack, or another connected app.
_Avoid_: native module, first-class product surface

**Legacy Google provider**:
The current direct Google Workspace implementation in this repo. It is migration scaffolding, not the long-term native provider model.
_Avoid_: native provider, permanent Google core, final architecture

**Provider replacement slice**:
A vertical migration step where one legacy capability is proven through the **Composio native provider** and then the corresponding legacy provider path is removed.
_Avoid_: parallel implementation, compatibility shim, dual provider mode

**MCP client authentication**:
Authentication from an MCP client, such as Codex or Claude, to this MCP server.
_Avoid_: Google OAuth, user login

**Provider authorization**:
Authorization from a provider layer to a connected external service on behalf of the account owner.
_Avoid_: MCP login, client bearer auth, AOJ Workbench login

**Static bearer auth**:
A shared bearer token used for MCP client authentication.
_Avoid_: OAuth, Google token

**External authorization server**:
A separate service that owns OAuth login for MCP client authentication.
_Avoid_: Google OAuth, gdrive MCP server

**Remote MCP runtime**:
The supported AOJ Workbench MCP server surface exposed as an HTTP endpoint hosted outside the user's machine.
_Avoid_: local MCP server, stdio server, local runtime

**Connected account**:
An external service account authorized through the **Composio native provider** for use by AOJ Workbench.
_Avoid_: AOJ Workbench user, MCP client, raw email address

**Connected mailbox**:
An email mailbox authorized for agent access through the **Composio native provider**.
_Avoid_: account, user account, Gmail account

**Email attachment**:
A file-like item carried by a message in a **Connected mailbox**.
_Avoid_: document, Drive file, message body

**Attachment metadata**:
The non-content description of an **Email attachment**, such as filename, media type, size, and retrieval identity.
_Avoid_: attachment content, file bytes

**Attachment content**:
The original bytes of an **Email attachment** made available to an agent workflow.
_Avoid_: attachment metadata, parsed text

**Decoded attachment text**:
Human-readable text extracted from **Attachment content** when the attachment format supports reliable text decoding.
_Avoid_: raw attachment, OCR, summary

**Mailbox owner**:
The person who owns one or more **Connected mailboxes** and grants assistant access.
_Avoid_: account holder, token owner

**Mailbox alias**:
A stable owner-scoped label used to select or describe a **Connected mailbox** without exposing the raw email address.
_Avoid_: email address, account name

**Agent workflow**:
The user-defined behavior that decides how tool results become briefings, organization, or actions.
_Avoid_: MCP server behavior, tool contract

**Pooled mailbox access**:
Assistant access to multiple **Connected mailboxes** as a shared resource while preserving owner and alias identity.
_Avoid_: shared inbox, merged account

## Relationships

- **MCP client authentication** protects access to this server.
- **AOJ Workbench** exposes one agent-facing MCP connector for daily-work tools.
- **Composio native provider** is the long-term native provider layer for external service connectivity.
- **Provider toolkits** are reached through the **Composio native provider**, including Google Workspace, Gmail, Outlook, Notion, Stripe, YouTube, and other selected services.
- **Legacy Google provider** may exist during migration, but it is not the destination architecture.
- A **Provider replacement slice** proves behavior through the **Composio native provider** before removing the matching **Legacy Google provider** code.
- The migration should not leave permanent dual paths that confuse coding agents about the supported provider model.
- **Provider authorization** authorizes connected external services through the provider layer.
- **Static bearer auth** is the supported first-class mechanism for **MCP client authentication**.
- An **external authorization server** may later enable Codex-initiated MCP login without making this server an identity provider.
- The **Remote MCP runtime** is the only supported MCP runtime for **AOJ Workbench**.
- Local stdio, local HTTP, and local bootstrap flows are not supported MCP server modes.
- A **Connected account** belongs to a provider toolkit and is selected through policy, alias, or explicit workflow context.
- A **Mailbox owner** may have many **Connected mailboxes**.
- A **Connected mailbox** has one **Mailbox alias** within an assistant context.
- **Mailbox aliases** are scoped by **Mailbox owner**.
- A message in a **Connected mailbox** may have zero or more **Email attachments**.
- An **Email attachment** has **Attachment metadata** whether or not its **Attachment content** is retrieved.
- **Decoded attachment text** is derived from **Attachment content** only when the file format and size are appropriate for agent-readable text extraction.
- An **Agent workflow** decides how to brief, group, prioritize, or act on data from **Connected mailboxes**.
- **Pooled mailbox access** allows an **Agent workflow** to work across many **Connected mailboxes** without erasing **Mailbox owner** or **Mailbox alias** identity.

## Example dialogue

> **Dev:** "Should `codex mcp login gdrive` create Google tokens?"
> **Domain expert:** "No — Codex authenticates to AOJ Workbench with **static bearer auth**. External service authorization is **Provider authorization** handled through the provider layer."

> **Dev:** "Should Claude connect to a local stdio process for gdrive?"
> **Domain expert:** "No — clients connect to the **Remote MCP runtime** by URL; local stdio, local HTTP, and local bootstrap flows are not supported server modes."

> **Dev:** "Is this just a Drive server?"
> **Domain expert:** "No — call it **AOJ Workbench**. It is the user's self-hosted knowledge-work surface, and Google is only one possible **Provider toolkit**."

> **Dev:** "Should Google remain the native provider and Composio sit beside it?"
> **Domain expert:** "No — **Composio native provider** is the target provider layer. The **Legacy Google provider** is migration scaffolding until the Composio-backed model covers the required workflows."

> **Dev:** "Once a Composio-backed Gmail capability is green, should we keep the old Google implementation just in case?"
> **Domain expert:** "No — complete a **Provider replacement slice** by removing the corresponding **Legacy Google provider** path after the Composio-backed behavior is verified."

> **Dev:** "Should agents connect separately to AOJ Workbench, Composio, Notion, Stripe, and Gmail?"
> **Domain expert:** "No — agents should connect to **AOJ Workbench** as the single MCP surface. AOJ Workbench routes to selected **Provider toolkits** behind that interface."

> **Dev:** "Can I treat my spouse's five email inboxes as my accounts?"
> **Domain expert:** "No — model them as **Connected mailboxes** owned by a **Mailbox owner** who has granted assistant access."

> **Dev:** "Should we call one inbox `shopping`?"
> **Domain expert:** "Use an owner-scoped **Mailbox alias** like `wife/shopping` so it cannot be confused with another owner's shopping mailbox."

> **Dev:** "Should the MCP server decide whether email briefings are unified or grouped?"
> **Domain expert:** "No — that is an **Agent workflow** decision; the server should expose tool access with enough mailbox identity for the workflow to decide."

> **Dev:** "Once a spouse's mailbox is connected, is it just part of my inbox?"
> **Domain expert:** "No — it participates in **Pooled mailbox access**, but the **Mailbox owner** and **Mailbox alias** remain part of the meaning."

> **Dev:** "When an email has a PDF attached, does reading the message mean we have read the PDF?"
> **Domain expert:** "No — the message and **Attachment metadata** can be read separately from **Attachment content**. **Decoded attachment text** only exists after the attachment content is retrieved and interpreted."

## Flagged ambiguities

- "OAuth compatibility" could mean either MCP client login or provider authorization — resolved: this repo does not become an OAuth authorization server; **Provider authorization** belongs to the provider layer.
- "local server" was used to mean both MCP client runtime and setup tooling — resolved: only the **Remote MCP runtime** is supported; local stdio, local HTTP, and local bootstrap flows are out of scope.
- "gdrive MCP" hides the product direction and Google-branded names collide with first-party products — resolved: use **AOJ Workbench** for the product and **Provider toolkit** for connected service capabilities.
- "native provider" could mean the current direct Google modules or the target integration layer — resolved: the target native provider is the **Composio native provider**; the direct Google implementation is the **Legacy Google provider**.
- "Composio companion MCP" described an interim connection pattern, not the product destination — resolved: Composio belongs inside AOJ Workbench as the **Composio native provider**.
- "migration" could imply keeping legacy Google and Composio paths indefinitely — resolved: use **Provider replacement slices** that prove one Composio-backed capability, then remove the matching legacy path.
- "account" could mean MCP client identity, Google OAuth identity, or email inbox — resolved: use **Connected mailbox** for an email inbox authorized for agent access.
- "alias" could be globally flat or owner-scoped — resolved: **Mailbox aliases** are owner-scoped.
- "briefing format" could be mistaken for an MCP server concern — resolved: briefing and organization choices belong to the **Agent workflow**.
- "pooled" could imply owner identity disappears — resolved: **Pooled mailbox access** preserves **Mailbox owner** and **Mailbox alias** identity.
- "read attachment" could mean listing **Attachment metadata**, retrieving **Attachment content**, or extracting **Decoded attachment text** — resolved: use the specific term for the intended level of access.
