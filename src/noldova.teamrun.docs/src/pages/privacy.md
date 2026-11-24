# Privacy and network

TeamRun keeps your chats on your computer and sends nothing to Noldova but its update checks.
This page lists what it keeps, every address it connects to, and what it doesn't send.

## What TeamRun keeps

- **Your chats, teammates and settings** are in TeamRun's database on your computer.
  Before an update installs, TeamRun keeps a backup of it, and keeps the last three.
- **No provider's sign-in.**
  Each provider's own tool keeps its sign-in.
  TeamRun doesn't open a provider's credentials or ask for its token.
- **What a sign-in check answers:** whether a provider is signed in, and the email or user name, plan, organization and sign-in method where the provider's tool gives them.
  For OpenCode, Antigravity, Pi, fx and Muse Code it keeps only whether the provider is signed in.
- **Each reply** keeps which provider, model, effort and speed answered it, but not your email, plan, organization or sign-in method, so signing out or removing a provider leaves none of them in a chat.
- **Values you type for a local ACP command,** such as a key it needs, are kept in your system's secret store and given only to that command.

## What TeamRun sends to Noldova

Only its update checks, to `updates.teamrun.noldova.com`:

- A check names TeamRun's version, your system and your processor, such as `teamrun/0.0.8 (win32; x64)`.
  It carries no cookie, account, install number or file path.
- The first check of each day adds `daily`, so Noldova can count how many copies are in use each day, by version, system and processor.
- Settings' **Check for updates** decides when: **Automatically**, **Only at start**, or **Only when I ask**, which sends a check only when you choose Check for updates.
- An update itself downloads from GitHub's release file hosts, `release-assets.githubusercontent.com` and `objects.githubusercontent.com`.

Beyond that daily count, TeamRun sends no usage data, and it sends no crash reports.
When a window crashes, TeamRun offers to reload it or to open its log folder; nothing is sent.

## Checks TeamRun makes on its own

The same **Check for updates** setting also lets TeamRun check for newer versions of the providers' tools it installed, and of the ACP agents you added from the registry.
Until Noldova Desktop has read your choice as the app starts, TeamRun counts it as **Automatically**, so these checks can run at start-up; set it to **Only when I ask** and they run only when you choose **Check for updates** in Settings' Providers tab.

| What TeamRun checks | TeamRun connects to |
|---|---|
| Claude Code's version | `downloads.claude.ai` |
| Codex's version | `releases.openai.com`, and `api.github.com` if that fails |
| The Codex app server, which TeamRun downloads itself | `api.github.com`, then `github.com` and GitHub's release file hosts, `release-assets.githubusercontent.com` and `objects.githubusercontent.com` |
| GitHub Copilot's version | `api.github.com` |
| The versions of the ACP agents you added from the registry | `cdn.agentclientprotocol.com` |

While you are signed in to GitHub, TeamRun also reads, from `api.github.com`, the issues and pull requests a chat links to and the pull request of a chat folder's branch, to show them.

## Addresses TeamRun connects to when you ask

| When you… | TeamRun connects to |
|---|---|
| list the agents of the ACP Registry, or add one | `cdn.agentclientprotocol.com`, for the list, and each agent's icon at the address the registry lists for it |
| install an ACP agent that is a program | the address the registry lists for its download |
| install an ACP agent that runs through `npx` | the npm registry, through your own `npm` |
| install or update Claude Code | `downloads.claude.ai` |
| install or update Codex | `releases.openai.com`, or `api.github.com` if that fails, and the address its release gives for the download |
| install or update GitHub Copilot | `api.github.com`, then `github.com` and GitHub's release file hosts for the download |
| install Grok | `x.ai` |
| install Cursor | `downloads.cursor.com` |
| install Antigravity | `dl.google.com` |
| sign in to GitHub for a chat's folder | `github.com` and `api.github.com` |
| add GitHub's MCP server | `api.githubcopilot.com` |
| add another MCP server | that server, and its sign-in page if it has one |
| open a page a teammate shows that loads scripts, styles or fonts | the sources pages may load them from: `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com` and `fonts.gstatic.com` |
| push or pull in a chat's folder | that folder's Git remotes |
| open a page in the browser | that page |

Providers TeamRun doesn't install itself, such as OpenCode, fx, Pi and Muse Code, have their own install command, which TeamRun opens in a terminal for OpenCode, fx and Pi, and which you run yourself for Muse Code; it connects where its maker says.

## Each provider's own service

TeamRun runs each provider's own command-line tool, and that tool talks to its provider's service as it does outside TeamRun: your messages, your files' contents that a teammate reads, and its replies go between the tool and its provider, under that provider's terms.
TeamRun doesn't choose where a provider's tool connects, and what a provider's tool sends about its own use is up to that provider and your settings with it.
