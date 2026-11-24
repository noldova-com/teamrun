# Providers and sign-in

A provider is one AI service TeamRun runs for you, through that service's own command-line tool.
Each provider signs in as you, on your own account and plan, and its own tool keeps the sign-in: TeamRun never sees your password or token.

This page covers adding, installing, signing in and updating each provider.
What each one can do once it runs is on [What each provider can do](provider-features.md), and any other agent from the ACP Registry is on [ACP agents](acp-agents.md).

## The Providers tab

The **Providers** tab has three parts:

- **Your providers:** the providers you added, grouped by kind, each with its account, its plan and up to two of its plan's limits.
- **Found on this computer:** folders of providers you already use outside TeamRun.
  **Add** on one adds it as it is and checks its sign-in.
- **Add provider:** a card for each kind with whether it is installed, a name filled in for the new provider, such as Personal or Work, and a link to use an existing folder.

**Add a provider** in the composer and Settings' **Manage providers** open this tab too.

### Adding and installing

**Add** on a kind's card installs it first when TeamRun installs that kind itself, with its progress and **Cancel**.
For a kind TeamRun doesn't install, the card shows the provider's own install command, and **Add** runs it in a terminal below the panel; TeamRun adds the provider once it finds the tool, or says the command ended without installing it.
A kind with no provider yet also offers **Get a subscription**.

A card says **Needs <program> first** when your computer lacks a program the install needs, such as unzip or tar, and **Can't install here** when the kind can't install on this computer for another reason.

Each provider you add gets a folder of its own, so you can add two of a kind, such as a Personal and a Work Codex, each signed in to its own account.
TeamRun tags a provider **Same sign-in** when it is signed in to the same account as an earlier one of its kind.

### Signing in

A new provider starts its sign-in as soon as it is added.
The row says where the sign-in finishes, in your browser or in a terminal:

- **In the browser:** if the page doesn't open, **Didn't open?** offers **Copy link** and **Open sign-in page**.
- **In a terminal:** TeamRun runs the provider's own login command in a terminal under Your providers, and checks the sign-in when the command ends.
  If the terminal closes before then, the row says the sign-in didn't finish, with **Sign in again**.

The **⋯** button at a row's end opens the provider's menu, with only the actions that apply, such as **Sign in**, **Sign out**, **Edit…**, **Check again** and **Show profile folder**.
A row whose sign-in expired says **Sign-in expired** and offers **Sign in**; a failed check says why and offers **Sign in again**.
The heading of Your providers says when the providers were last checked, with a refresh that checks them again.

### Updates

When TeamRun installed a provider's tool itself and a newer version is out, the kind's heading says **version <n> is available**, with **Update to <n>**.
A tool you installed another way, such as with npm, Homebrew or winget, says it updates on its own, and TeamRun offers no update for it.
TeamRun never offers an older version than the one you have, so a tool that updated itself stays as it is.

## Claude Code

- **Install:** TeamRun installs Claude Code from Claude Code's own releases, as its own installer does, and checks the download first.
- **Sign in:** **Sign in** runs `claude auth login` in a terminal.
- **Your own Claude Code:** a provider in your usual Claude Code folder shares its sign-in with the Claude Code you use outside TeamRun, so its **Sign out** warns that it signs your own Claude Code out too.
  A provider in a folder of its own keeps a sign-in of its own.
- **Update:** TeamRun updates the Claude Code it installs.
  One installed by npm, Homebrew or winget updates by its own means.

## Codex

- **Install:** TeamRun installs Codex from OpenAI's releases, in the layout Codex's own installers make, and checks the download first.
  When another Codex comes first on your computer's path, the install says which one TeamRun runs.
- **Sign in:** TeamRun starts Codex's own sign-in.
- **Update:** TeamRun updates a Codex it installed; one installed by npm or Homebrew updates by its own means.
  When Codex is updated while TeamRun runs, TeamRun starts using the new version once the work running on the old one ends.

On Windows:

- Codex before 0.163.0 can fail every command while the Codex app is open.
  TeamRun stops such a turn and says to close the Codex app, and to update Codex when it is older than 0.163.0.
- Updating Codex while it is in use can leave it half-installed, and Codex then refuses to start.
  TeamRun says so: quit TeamRun and every other app using Codex, reinstall Codex, then try again.

## GitHub Copilot

GitHub Copilot needs a GitHub Copilot subscription.

- **Install:** TeamRun installs GitHub Copilot's command-line tool from GitHub's releases.
  You can also install it yourself, such as with `npm install -g @github/copilot`.
- **Sign in:** **Sign in** runs `copilot login` in a terminal.
  The provider then works as that sign-in, not as a GitHub token set on your computer.
- **Models:** Copilot lists the models your plan offers, with **Auto**, which lets Copilot pick the model for each task.
  On Copilot Free, whose plan includes only Auto, TeamRun says so.
  **Refresh models**, in the composer's menu and the teammate dialog, lists them again, so a model you turned on or off in Copilot's settings shows without a restart.
- **A changed plan:** Copilot keeps answering with the plan of its sign-in, so after a plan change, run `copilot login` again and then **Refresh models**.
- **Update:** TeamRun updates the Copilot it installed; one installed by npm, Homebrew or winget updates by its own means.

The **minimal** effort needs GitHub Copilot CLI 1.0.69 or later.
If you set a default model in Copilot's own settings, Copilot uses that model rather than Auto, and doesn't say which.

## Antigravity

- **Install:** TeamRun installs a checked build of Antigravity's server.
  TeamRun works with version 1.3; a server of another version is refused, with the reason on the provider's row.
- **Your own server:** to run a server you have, set its path in the provider's **Edit…** dialog, in **Binary path**.
- **Sign in:** Antigravity offers its Google sign-in in your default browser.
  A reply also signs in again in the browser when the sign-in has expired.
- **Models:** Antigravity names its models only once it has answered, so until its first reply, TeamRun uses its default model and says its models aren't listed yet.
  They show after that reply, or on **Refresh models**.

## Cursor

- **Install:** **Install** puts a checked build of Cursor's command-line tool, 2026.10.22-27dcf5f, in TeamRun's own data folder.
  A Cursor you installed with Cursor's own install command comes first and updates by its own means.
- **Sign in:** **Sign in** runs `cursor-agent login` in a terminal, and **Sign out** runs `cursor-agent logout`.
  TeamRun signs Cursor in only this way, never with an API key.
- **On macOS:** Cursor keeps its sign-in in the login keychain, which every Cursor on the Mac shares, so TeamRun takes one Cursor provider per Mac.
  Its **Sign out** also signs out your own Cursor command-line tool, and its **Sign in** replaces the account that tool uses.
- **On Windows and Linux:** each Cursor provider keeps a sign-in of its own.
  Commands a Cursor teammate runs then don't find settings and sign-ins that some tools keep in your user settings folder, such as git's and the GitHub CLI's.
- **Your MCP servers:** Cursor in TeamRun also starts the MCP servers in your `~/.cursor/mcp.json`, and can't be told to skip them.
- **Plans:** on a plan that doesn't include the chosen model, Cursor answers each message by asking you to upgrade, and TeamRun shows that answer as the reply.

## fx

- **Install:** you install fx with fx's own install command; on macOS and Linux, **Install** runs it in TeamRun's terminal. fx has no Windows build yet, so on Windows it stays not found.
- **Your own fx:** TeamRun runs the fx you installed, with its sign-in, settings, saved sessions and MCP servers.
  So TeamRun takes one fx provider per computer.
- **Sign in:** **Sign in** runs `fx login` in a terminal, which signs in your own fx.
- **Update:** updates are yours, with `fx upgrade`.

TeamRun signs fx in only with its own sign-in and leaves fx's API key out.
fx uses the model provider your fx is set up with, such as Vercel AI Gateway, and TeamRun leaves that choice as it is.

## Pi

- **Install:** TeamRun installs nothing for Pi.
  Add provider shows Pi's install command for you to run: `curl -fsSL https://pi.dev/install.sh | sh` on macOS and Linux, and `npm i -g @earendil-works/pi-coding-agent` on Windows.
  Where Node.js is missing, Pi's installer offers to install it.
  At its end it asks whether to start Pi now; if you say yes, quit Pi in that terminal and TeamRun then adds the provider.
- **Version:** TeamRun needs Pi 1.1.0 or later, and says so, naming both versions, when yours is older.
- **Your own Pi:** a Pi provider in Pi's usual folder shares its settings, sign-ins, sessions and extensions with the Pi you use outside TeamRun.
- **Sign in:** **Sign in** runs `pi` in a terminal.
  Type `/login`, then `/quit`; TeamRun checks the sign-in when Pi quits or the terminal closes.
  With no model chosen in Pi, the provider shows signed out and says to choose a model in Pi.
- **Update:** updates are yours, with `pi update`.

## Grok

- **Install:** TeamRun installs a checked build of Grok, as Grok's own installers do.
- **Sign in:** TeamRun starts Grok's own sign-in.
  A provider in your usual Grok folder shares its sign-in with your own Grok; a provider in another folder keeps one of its own.
- **Update:** TeamRun offers an update only for the Grok it installed, and only to a newer version.
  Grok updates itself when you run it yourself, and a Grok that did shows its own version with no update.
- **Models:** until Grok has loaded your account's models, TeamRun shows only its built-in ones, and a turn on another model fails saying to try again.

## OpenCode

- **Install:** TeamRun runs your own OpenCode and installs no copy of it.
  While none is found, **Install** opens a terminal that runs OpenCode's own installer: `curl -fsSL https://opencode.ai/install | bash` on macOS and Linux, and `npm i -g opencode-ai@1` on Windows.
  TeamRun finds it afterwards without a restart.
- **Your own OpenCode:** it runs with your own configuration, plugins, keys and sign-in, as its command line has them.
- **Sign in:** **Sign in** runs `opencode auth login` in a terminal.
- **Update:** updates are yours.
  A version TeamRun doesn't support is refused, with the reason.

## Muse Code

- **Install:** TeamRun installs no copy of Muse Code and doesn't run its installer for you yet; install it with its maker's command, `curl -fsSL https://dev.meta.ai/install.sh | sh` on macOS and Linux, or `irm https://dev.meta.ai/install.ps1 | iex` on Windows.
- **Your own Muse Code:** TeamRun runs your `muse`, from your PATH or `~/.local/bin`, and turns on its ACP connection for it.
  On macOS, Muse Code keeps its sign-in in the keychain, so a Mac has one Muse Code provider.
- **Sign in:** **Sign in** runs `muse login` in a terminal; this hasn't been checked with Muse Code yet.
- **Update:** updates are yours; Muse Code updates itself.
- **Features:** most of what TeamRun offers hasn't been checked with Muse Code yet, as [What each provider can do](provider-features.md) shows.

## When a model isn't offered

When GitHub Copilot, Grok, OpenCode, Cursor or Antigravity doesn't offer the chosen model, the reply fails and says to refresh the models and choose one; its **Choose a model** opens the teammate's dialog or the composer's model picker.
The Teammates table marks a model missing from the provider's current list **Not in catalog**.
