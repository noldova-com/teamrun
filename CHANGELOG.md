# Changelog

**Scope:** What each released version of TeamRun holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.3

### New

- **Restart to update on macOS:** Restart to update installs the update and restarts TeamRun into it, also for a copy you can't write to, such as one a `.pkg` installed in Applications.
- **Signing in to GitHub opens your own browser:** GitHub's sign-in page, from Settings → GitHub and from the Git view's GitHub row, and Manage access on GitHub open in your system's browser, where you're signed in to GitHub, whatever Settings choose for where links open.
- **Links in the terminal open in your own browser:** a link you Ctrl+click in a terminal, Cmd+click on macOS, opens in your system's browser by default, so the sign-in links that tools print reach the browser where you're signed in.
  The setting Open clicked links can open them in TeamRun's browser instead.
- **Computer use for Codex teammates:** a Codex teammate gets TeamRun's computer tools once computer use is turned on, also in a chat whose session started before, and no longer reaches Codex's own computer use, which needs Codex's desktop app.

### Fixed

- **More sign-in pages open in your own browser:** a shared MCP server's sign-in page and a provider's subscribe page now open in your system's browser, as a provider's sign-in page does since 0.0.2.
- **Terminal:** on Windows, a key typed right after a resize is no longer lost, and an agent's run no longer types into a line you've half typed.
- **Terminal in the bottom dock:** a terminal tab moved into the bottom dock grows the dock to the fewest rows a run needs.
- **A run in a new terminal:** it waits for the terminal's pane to take its size, so the shell starts at the size it shows.
- **Completing a command's options:** the first completion of a command's options waits for the shell's answer.
- **PowerShell on Windows:** on a machine with many PowerShell modules, finding PowerShell is fast after the first time.
- **Inline terminals:** when a Run starts at another code block, the earlier block's terminal is no longer removed and drawn again while TeamRun keeps its output.
- **Explorer:** New chat, Open folder and Open browser are spaced as the chat rows are.

## 0.0.2

### Fixed

- **Signing in to a provider opens your own browser:** the provider's sign-in page, whether it opens by itself when you sign in or from "Open the sign-in page", now opens in your system's browser, where you're already signed in to the provider's site, whatever Settings choose for where links open.
  In 0.0.1 it could open in TeamRun's own browser instead.

## 0.0.1

The first public version of TeamRun, a desktop app for working with AI agents as a team.

### What it does

- **Chats with agents from several providers in one window:** Claude Code, Codex, GitHub Copilot, Grok, OpenCode, Cursor, Antigravity, Pi, fx and Muse Code, and agents from the ACP registry or a local ACP command.
  TeamRun runs each provider's own command-line tool, which keeps its own sign-in; TeamRun stores no provider's sign-in, opens no credentials file and doesn't ask for a provider's token.
  It can install the tools of Claude Code, Codex, GitHub Copilot, Grok, Cursor and Antigravity, and of agents from the ACP registry.
- **Teammates:** an agent with a name, a role, a provider, a model and an effort, which you add to chats and call with an `@` mention.
  A teammate can message the teammates of another chat and hand work on, up to the number of hand-offs set in Settings.
- **Projects:** a chat works in a project's folder, or in an empty folder of its own, and chats are found by their titles and messages.
- **Approvals in one place:** a command, a change to files or a new site that an agent asks for waits for your answer in the chat, and on a provider with a plan mode, a chat can have its agents plan for your approval before they change anything.
  Only you answer an approval, in the window.
- **Following the work:** each reply shows its activity, the files it changed, its plan, its sub-agents and its background tasks, and a message sent while a reply runs waits its turn.
  A chat can be rewound to an earlier message, putting back the files the later replies changed where their checkpoints allow.
- **Tools beside the chat:** a terminal in the chat's folder, a Git view of it, and web pages that agents open in the app, on the sites you allow for the workspace.
- **Computer use (preview)** on Windows and macOS, off until you turn it on in Settings, with a border around every display while an agent controls the screen, and grants you can see and revoke.
- **MCP servers:** servers you share with every teammate, or with chosen ones, and TeamRun's own server, which gives teammates its tools.
- **Usage limits:** the plan usage of each provider that reports it shows in the app, and a teammate whose account reaches its usage limit can carry on with the next account, model and effort you list for it.
- **A command line:** `<app command> teamrun` manages projects, chats and providers, lists teammates, sends messages and stops replies.
- **Packages:** `@noldova/teamrun` and the packages it depends on, `@noldova/teamrun.cli`, `.core`, `.protocol`, `.providers`, `.runtime`, `.services` and `.window`, all at this version and under the MIT License, are built from this repository into the app; none is published to a registry.

### Where it runs

- Windows and Linux, on x64 and ARM64, and macOS, on Apple silicon and Intel.
- It is built on Noldova Desktop, and the installed app checks for its updates.

### Known limits

- What each provider can do differs: Settings › "What each provider can do" shows, for each provider, which abilities work, which it can't offer, and which aren't built or checked yet.
- Each provider's tool must be signed in with its own account; TeamRun asks the tool whether it is, and for some providers it can't read the account's details.
- Carrying on after a usage limit works only on providers whose limits TeamRun can read; a teammate's settings show which.
- Computer use is a preview, off by default, and isn't available on Linux.
- A teammate reaches other chats through the app's command in its shell on Windows, macOS and Linux, but not from a Linux shell running inside Windows.
