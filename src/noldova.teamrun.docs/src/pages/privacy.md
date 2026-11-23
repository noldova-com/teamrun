# Privacy and network

TeamRun keeps your chats on your computer and sends nothing to Noldova but its update checks. This page lists what it keeps, every address it connects to, and what it doesn't send.

## What TeamRun keeps

- **Your chats, teammates and settings** are in TeamRun's database on your computer. Before an update installs, TeamRun keeps a backup of it, and keeps the last three.
- **No provider's sign-in.** Each provider's own tool keeps its sign-in. TeamRun doesn't open a provider's credentials or ask for its token.
- **What a sign-in check answers:** whether a provider is signed in, and the email or user name, plan, organization and sign-in method where the provider's tool gives them. For OpenCode, Antigravity, Pi and fx it keeps only whether the provider is signed in.
- **Each reply** keeps which provider, model, effort and speed answered it, but not your email, plan, organization or sign-in method, so signing out or removing a provider leaves none of them in a chat.
- **Values you type for a local ACP command,** such as a key it needs, are kept in your system's secret store and given only to that command.

## What TeamRun sends to Noldova

Only its update checks, to `updates.teamrun.noldova.com`:

- A check names TeamRun's version, your system and your processor, such as `teamrun/0.0.8 (win32; x64)`. It carries no cookie, account, install number or file path.
- The first check of each day adds `daily`, so Noldova can count how many copies are in use each day, by version, system and processor.
- Settings' **Check for updates** set to **Only when I ask** sends a check only when you choose Check for updates.
- An update itself downloads from GitHub's release file hosts, `release-assets.githubusercontent.com` and `objects.githubusercontent.com`.

TeamRun sends no usage data and no crash reports. When a window crashes, TeamRun offers to reload it or to open its log folder; nothing is sent.

## Addresses TeamRun connects to when you ask

| When you… | TeamRun connects to |
|---|---|
| list the agents of the ACP Registry, or add one | `cdn.agentclientprotocol.com`, for the list and the agents' icons |
| install an ACP agent that runs through `npx` | the npm registry, through your own `npm` |
| install Claude Code | `downloads.claude.ai` |
| install Codex | `releases.openai.com`, then `api.github.com` |
| install GitHub Copilot | `api.github.com` |
| install Grok | `x.ai` |
| install Cursor | `downloads.cursor.com` |
| install Antigravity | `dl.google.com` |
| sign in to GitHub for a chat's folder | `github.com` and `api.github.com` |
| add GitHub's MCP server | `api.githubcopilot.com` |
| add another MCP server | that server, and its sign-in page if it has one |
| push or pull in a chat's folder | that folder's Git remotes |
| open a page in the browser | that page |

Providers TeamRun doesn't install itself, such as OpenCode, fx and Pi, show their own install command, which you run; it connects where its maker says.

## Each provider's own service

TeamRun runs each provider's own command-line tool, and that tool talks to its provider's service as it does outside TeamRun: your messages, your files' contents that a teammate reads, and its replies go between the tool and its provider, under that provider's terms. TeamRun doesn't choose where a provider's tool connects, and what a provider's tool sends about its own use is up to that provider and your settings with it.
