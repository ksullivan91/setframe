# Figma MCP Connection Notes (GitHub Copilot CLI)

## Status: Supported per Figma's catalog, but remote connection is currently failing (404). Local server is the recommended workaround.

Date investigated: 2026-08-20

**Correction:** An earlier version of this document concluded that GitHub
Copilot CLI was simply unsupported by Figma's remote MCP server. That was
wrong. Figma's official MCP Catalog (`https://www.figma.com/mcp-catalog/`)
explicitly lists **"GitHub Copilot CLI"** as a supported client:

> GitHub Copilot CLI — Supports Figma Design, Figma Make, and Figma Weave.
> Remote and local servers. Read and write access.

However, Figma's written install guide
(`developers.figma.com/docs/figma-mcp-server/remote-server-installation/`)
only has explicit, tested setup steps for Claude Code, Codex, Cursor, VS
Code, and Xcode — there is no Copilot-CLI-specific section yet, even though
the catalog card links back to that same generic guide. This gap between
the catalog announcement and the written setup steps is the most likely
explanation for the `404` we hit: the remote server's client
allowlist/handshake may not yet be fully rolled out for Copilot CLI's exact
client identification, even though support has been announced.

## What we tried

1. Ran `/mcp` in GitHub Copilot CLI.
2. Added a server:
   - Name: `figma`
   - Type: `HTTP`
   - URL: `https://mcp.figma.com/mcp`
3. Connection failed immediately with:

   ```text
   Connection failed: Error: failed to initialize MCP client: Send message error Transport
   [...StreamableHttpClientWorker...] error: unexpected server response: HTTP 404 Not Found
   {"status":404,"err":"Not Found"}, when send initialize request
   ```

This happened before any OAuth prompt appeared, i.e. the server rejected the
`initialize` request itself rather than failing at authorization.

## What we verified

- GitHub Copilot CLI is up to date (`1.0.80`, matches latest published
  version — not a stale-client issue).
- Figma's catalog page (fetched directly, not just skimmed) confirms Copilot
  CLI support for both remote and local Figma MCP servers with read/write
  access.
- Figma and GitHub have publicly co-presented this integration (see
  `figma.com/webinars/mcp-github-copilot/` — a joint webinar on using the
  Figma MCP server with GitHub Copilot, including GitHub's own Primer design
  system token sync).
- The remote server config we used matches Figma's own documented JSON
  exactly (`{"url": "https://mcp.figma.com/mcp", "type": "http"}` equivalent),
  so this isn't a copy/paste mistake.
- The `404` happens at the MCP `initialize` request, before any OAuth
  prompt — i.e., Figma's edge/router rejects the request before our account
  identity is even in play.

**Working theory:** the catalog listing shipped slightly ahead of the
written setup guide and/or the server-side handshake rollout for this exact
client identifier. This is a timing/rollout gap, not a fundamental
incompatibility — but it currently blocks the remote server for us.

## Recommended path forward: use the local Figma Dev Mode MCP server

Figma also ships a **local** MCP server through the Figma desktop app, which
sidesteps the remote allowlist/handshake entirely because it's just a plain
local HTTP endpoint the desktop app opens once you're already signed in:

1. Install/open the **Figma desktop app** and sign in.
2. Open one of the three reference files (or any file) in the desktop app.
3. In Figma's menu: enable **"Enable Dev Mode MCP Server"** (under
   Preferences, or the Dev Mode panel — exact location per current Figma
   desktop UI).
4. In Copilot CLI, run `/mcp` and add a server:
   - Name: `figma-desktop`
   - Type: `HTTP`
   - URL: `http://127.0.0.1:3845/mcp`
5. No OAuth step is needed here — the desktop app is already authenticated;
   the local server just proxies its access.
6. Verify tools appear (`/env` or `/mcp` status), then re-attempt the Figma
   inspection/audit workflow from
   `setframe-branding-figma-mcp-copilot-prompt.md` §9 against the three
   reference files.

Caveat: this requires the Figma desktop app to stay open and the target file
loaded/active locally, which is a reasonable tradeoff for a one-time design
audit.

## Fallback if local server also fails

If the local server is unavailable (e.g., desktop app not installed) or also
errors, fall back to the VS Code path: VS Code has an explicit, tested
remote-server setup in Figma's docs, and GitHub Copilot Chat/Agent mode runs
inside it, so the audit can happen there and the resulting docs/tokens get
committed back to this repository for Copilot CLI to continue from.

## Re-check periodically

Retry the remote server (`https://mcp.figma.com/mcp`) periodically — this is
plausibly a short-lived rollout gap given the catalog listing and joint
GitHub/Figma webinar already exist.

## Decision

No Figma content has been inspected or copied yet. UI/design-system work
remains blocked on the VS Code-based Figma session above. Phase 0
architecture/backend research (this document's sibling docs) proceeds
independently since it has no dependency on Figma.
