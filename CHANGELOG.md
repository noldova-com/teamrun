# Changelog

**Scope:** What each released version of TeamRun holds, newest first.

A pull request that changes what a person gets adds its entry under `## Unreleased`, and the release names its version over the entries it ships, with `npm run set-version`, as the [README](README.md#releases) says.

## Unreleased

### New

- **Organization:** Show organization in the View menu opens the team's organization as its own view: you at the root, then each department with its count, its leader's card and its members' cards, nested to any depth, on a canvas you pan, zoom and fit, with an overview map (#317).
  A card shows its teammate's status, what it runs now and for how long, and, when chosen, its usage, its last message and its model; Cards show chooses the fields for every card, a card's own menu for itself.
  Pointing at a card or reaching it with the keyboard opens its details: status, whom it reports to, model, usage, last words and what it runs now; the messages beside the tree talk to the card you click.
  Edit structure adds, renames and deletes departments, chooses a department's leader, renames teammates, and adds, moves and removes members, asking before a delete or a removal.
  The view, the collapsed departments and the cards' fields are kept across a restart.

### Fixed

- **Claude Code on macOS:** a Claude Code signed in the usual way is listed as signed in, and its turns run, rather than showing `Sign-in required` (#338).
- **A chat's wake:** when work a chat sent to another chat ends, the chat shows a closed row, `Received a message from <chat> ›`, at the top of the reply it starts, rather than a message that read as the other teammate answering there, with the chat's IDs and a hint meant for the teammate; the chat's name opens that chat, and opening the row shows the replies; a wake that started no turn shows why below its row, one whose work never came back reads `No reply came back from <chat> ›`, and wakes from earlier versions show as the same row; deleting a chat whose replies already came back no longer drops them: they are delivered as received from a deleted chat and start the asking chat's turn (#296).
- **A sub-agent's or command's wake:** when a sub-agent or a background command of a chat ends and wakes it, the chat shows a closed row naming the work and how it ended, such as `Sub-agent "Search" ended as completed ›`, rather than a message with its IDs; opening the row shows its summary or the command's last lines, and one TeamRun restarted before says it was stopped or didn't come back (#300).
- **A chat's mentioned teammate:** a chat whose next answer goes to a teammate, after a message that mentions one, keeps that teammate when you open another chat or the new chat, or come back to it; the composer's settings no longer replace it with the default teammate, and a mode picked there is that teammate's mode (#326).
- **Ending a sub-agent's processes on Windows:** a stop, deleting the chat, quitting, a sign-out or the provider's exit ends what a kept sub-agent started even when TeamRun's PowerShell stalls, within seconds rather than leaving it running (#309).
- **Ending a process tree on Windows:** a process whose end failed is ended again while the tree's listing still shows it, in each of the stop's ten rounds, rather than left running after its first end, and each end waits for the process to exit, all of a round's within two seconds (#344).

### Changed

- **The first launch's Skip for now and Continue:** they sit in a footer along the Providers tab's bottom edge, so they stay in view on a short window while the providers scroll above them (#350).
- **Git 0.0.6:** TeamRun takes the Git and GitHub modules at 0.0.6, on Noldova Desktop 0.0.11 like TeamRun itself (#342).
- **Noldova Desktop 0.0.10, `@noldova/ui.components.angular` 0.0.20 and Noldova's `context` packages 0.0.9:** TeamRun is built on these versions (#283, #288, #305, #314).

## 0.0.7

### Fixed

- **Modes and plan approvals:** a teammate's mode, Plan first, a plan's approval, the chat's responder and the default teammate change only from TeamRun's own window, and a message from elsewhere keeps only a mode you chose for the chat or the default teammate.
- **An Antigravity provider's server path:** it is set only from TeamRun's own window.
- **Providers and shared MCP servers:** only TeamRun's own window can give a provider a profile folder, when it's added or later, or switch a provider's own MCP servers, and a shared MCP server's secrets, the providers and teammates it reaches and the commands TeamRun runs for a provider or a shared server change only from the window.
- **A question card off the screen:** a question card keeps its picks and typed text when its row scrolls away and after a far jump in the chat's history, as wrapped code blocks and a row's other controls are kept (#158, #250).
- **Editing a waiting message:**
  - The edit ends when the box shows another chat or takes a rewound message, so Enter no longer saves that text as the edit (#206).
  - While an edit is open, a pasted or dropped file is refused with a note, and the edit stays open until its save succeeds (#259, #260).
  - An Escape that closes an input method's candidates keeps the edit (#209).
  - A file pasted while a send prepares its files is no longer dropped without a word (#211).
- **Waiting messages:** a sent message no longer shows as still waiting when a change arrives during the chat's read (#162), and a message being sent or steered still goes when the waiting list can't be read again, rather than being lost (#269).
- **Saving a checkpoint:** a reply keeps "Saving a checkpoint…" through a rename or another change made in another window (#165).
- **The focus:** Cancel edit, Stop, a Sustain move and the swaps in the ACP agents and shared MCP servers dialogs keep the focus on a control, so the next Tab goes on from there (#208).
- **Sent files:** deleting a chat, forgetting a project or rewinding a chat removes the files its messages sent, and files left from before are swept (#189).
- **Stop during a hand-off:** a Stop that lands while a reply hands off to a mentioned teammate stops that teammate's reply too and lists it as stopped (#221).
- **Signing in to a shared MCP server:** Sign out, or a later sign-in, ends a sign-in still under way, which no longer comes back as signed in, and the first request to the server has a time limit (#225, #234, #235).
- **The end of a chat's work:** each step after a chat's work ends, sending answers, sending waiting messages and starting wakes, runs even when an earlier one fails, and the failure is logged (#222).
- **Quitting:** quitting waits for the start-up folder sweep, and a rewind or a move that starts during the quit is refused, rather than the database closing under them (#231, #232).
- **Helpers:** Stop and quitting return when a helper's end can't be written, such as on a full disk, a helper's task and its row agree on how it ended, and a helper's failed save or stop is logged rather than skipping the other stops (#220, #279).

### Changed

- **The command line's add-provider:** it no longer takes a folder: TeamRun makes the new provider's profile folder itself, and the provider signs in from TeamRun's window, so a script that passes a folder must drop it.
- **Noldova Desktop 0.0.9 and `@noldova/ui.components.angular` 0.0.18:** TeamRun is built on these versions (#253, #255).

## 0.0.6

### Fixed

- **A teammate after a folder is attached:** a Codex teammate that already answered in a chat works in the chat's folder after a folder is attached, replaced or detached, rather than in the folder it started in (#137).
- **A wake during a rewind, a move or an attach:** a wake that arrives while a rewind, a move or an attach is under way waits until it ends and then starts, rather than leaving a reply that stays Pending until TeamRun restarts.
- **Take over and the end of a turn:** a teammate's tool call that arrives just before you press Take over, or before its turn ends, is refused rather than run.
- **Signing in to an MCP server:** a malformed request to the sign-in's callback gets a not-found answer, and the sign-in keeps waiting for the real one.

## 0.0.5

### New

- **Attach a folder to a chat:** a chat without a project can attach an existing folder from its menu, Attach a folder…, and work there in place, with nothing copied; Replace the folder… and Detach the folder change it later, and the chat's breadcrumb and its row's tooltip name the folder.
  A rewind restores your files there from the checkpoint of the folder each reply ran in, and when the chat has moved to another folder since, it restores no files and says so.
  Deleting or moving such a chat leaves the folder and its files where they are.
  Known: a teammate that already answered in the chat keeps working in the chat's own folder until a fix (#137).
- **A reply saving its checkpoint:** a working reply reads "Saving a checkpoint…" while TeamRun takes its checkpoint, and Stop reads "Stopping…" from the first click until the reply stops.

### Fixed

- **Inline terminals on a short history:** an inline terminal gets at least 8 rows, within the history, so a command and its output show below the prompt rather than the prompt alone.

## 0.0.4

This version holds the same app as 0.0.3, released right after it so that updating can be tried across more than one version, such as from 0.0.2 straight to 0.0.4.

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
