# AOJ Workbench

This context defines the language for AOJ Workbench, a personal knowledge-work MCP surface that bridges MCP clients and workspace APIs.

## Language

**AOJ Workbench**:
The canonical product name for this MCP server and companion knowledge-work surface.
_Avoid_: Google Workspace MCP, GWS MCP, gdrive MCP, Google Drive MCP, Drive MCP, Gmail MCP

**Google Workspace API surface**:
The upstream Google APIs currently exposed through AOJ Workbench, including Drive, Sheets, Forms, Docs, Gmail, and Calendar.
_Avoid_: product name, app name, agent name

**MCP client authentication**:
Authentication from an MCP client, such as Codex or Claude, to this MCP server.
_Avoid_: Google OAuth, user login

**Google OAuth**:
Authorization from this MCP server to Google Workspace APIs on behalf of the Google account owner.
_Avoid_: MCP login, client bearer auth

**Static bearer auth**:
A shared bearer token used for MCP client authentication.
_Avoid_: OAuth, Google token

**External authorization server**:
A separate service that owns OAuth login for MCP client authentication.
_Avoid_: Google OAuth, gdrive MCP server

**Remote MCP runtime**:
The supported AOJ Workbench MCP server surface exposed as an HTTP endpoint hosted outside the user's machine.
_Avoid_: local MCP server, stdio server, local runtime

**Connected mailbox**:
An email mailbox authorized for agent access through an external account-management provider.
_Avoid_: account, user account, Gmail account

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
- **Google OAuth** authorizes this server to call Google Workspace APIs.
- **Static bearer auth** is the supported first-class mechanism for **MCP client authentication**.
- An **external authorization server** may later enable Codex-initiated MCP login without making this server an identity provider.
- **AOJ Workbench** exposes the **Google Workspace API surface** for Drive, Sheets, Forms, Docs, Gmail, and Calendar.
- The **Remote MCP runtime** is the only supported MCP runtime for **AOJ Workbench**.
- Local stdio, local HTTP, and local bootstrap flows are not supported MCP server modes.
- A **Mailbox owner** may have many **Connected mailboxes**.
- A **Connected mailbox** has one **Mailbox alias** within an assistant context.
- **Mailbox aliases** are scoped by **Mailbox owner**.
- An **Agent workflow** decides how to brief, group, prioritize, or act on data from **Connected mailboxes**.
- **Pooled mailbox access** allows an **Agent workflow** to work across many **Connected mailboxes** without erasing **Mailbox owner** or **Mailbox alias** identity.

## Example dialogue

> **Dev:** "Should `codex mcp login gdrive` create Google tokens?"
> **Domain expert:** "No — **Google OAuth** is handled by the server's existing auth flow; Codex authenticates to the MCP server with **static bearer auth**."

> **Dev:** "Should Claude connect to a local stdio process for gdrive?"
> **Domain expert:** "No — clients connect to the **Remote MCP runtime** by URL; local stdio, local HTTP, and local bootstrap flows are not supported server modes."

> **Dev:** "Is this just a Drive server?"
> **Domain expert:** "No — call it **AOJ Workbench**. It exposes a **Google Workspace API surface**, but it is not a Google product."

> **Dev:** "Can I treat my spouse's five email inboxes as my accounts?"
> **Domain expert:** "No — model them as **Connected mailboxes** owned by a **Mailbox owner** who has granted assistant access."

> **Dev:** "Should we call one inbox `shopping`?"
> **Domain expert:** "Use an owner-scoped **Mailbox alias** like `wife/shopping` so it cannot be confused with another owner's shopping mailbox."

> **Dev:** "Should the MCP server decide whether email briefings are unified or grouped?"
> **Domain expert:** "No — that is an **Agent workflow** decision; the server should expose tool access with enough mailbox identity for the workflow to decide."

> **Dev:** "Once a spouse's mailbox is connected, is it just part of my inbox?"
> **Domain expert:** "No — it participates in **Pooled mailbox access**, but the **Mailbox owner** and **Mailbox alias** remain part of the meaning."

## Flagged ambiguities

- "OAuth compatibility" could mean either MCP client login or Google Workspace authorization — resolved: this repo does not become an OAuth authorization server; **Google OAuth** remains upstream server-to-Google authorization.
- "local server" was used to mean both MCP client runtime and setup tooling — resolved: only the **Remote MCP runtime** is supported; local stdio, local HTTP, and local bootstrap flows are out of scope.
- "gdrive MCP" hides most of the product surface and Google-branded names collide with first-party products — resolved: use **AOJ Workbench** for the product and **Google Workspace API surface** for the provider capability.
- "account" could mean MCP client identity, Google OAuth identity, or email inbox — resolved: use **Connected mailbox** for an email inbox authorized for agent access.
- "alias" could be globally flat or owner-scoped — resolved: **Mailbox aliases** are owner-scoped.
- "briefing format" could be mistaken for an MCP server concern — resolved: briefing and organization choices belong to the **Agent workflow**.
- "pooled" could imply owner identity disappears — resolved: **Pooled mailbox access** preserves **Mailbox owner** and **Mailbox alias** identity.
