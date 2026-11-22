# Changelog

**Scope:** What each released version of TeamRun holds, newest first.

A pull request that changes what a person gets adds its entry under `## Unreleased`, and the release names its version over the entries it ships, with `npm run set-version`, as the [README](README.md#releases) says.

## Unreleased

### New

- **Several organizations:** TeamRun keeps organizations, each with its name, an optional default folder, its own departments, placements and layout, and its own Organization chats; your current organization, its teammates and its layout become My organization.
  A new teammate joins no organization, and an Organization chat with no folder of its own runs in its organization's folder; the window still shows only My organization, and the views to add, switch and remove organizations come in their own changes (#401).
- **Explorer:** an Organizations group lists each organization, whose name opens its own Organization view, then the teammates it places in no department and each of its departments by its path, such as `DevOps › Infra`, with its teammates; a teammate's row opens its Organization chat in that organization and shows when it waits or works, and Organization chats no longer show under Chats, Pinned or a project, even one pinned or moved there before (#402).
- **Explorer:** "+" on the Organizations group's header creates an organization, and the group shows an organization with no teammate yet; an organization's row menu renames it, sets, changes or clears its default folder, which its row's tooltip shows, and deletes it after you confirm, while another organization is left, closing its view and listing its chats in their project or under Chats; each teammate's row shows its status as a dot before its name, and its row menu moves the teammate's Organization chat into a project or a folder or attaches, replaces or detaches the chat's folder, opening the chat first when there's none yet, while its tooltip shows where the chat works (#402).
- **Organization:** Show organization in the View menu opens the team's organization as its own view: you at the root, then each department with its count, its leader's card and its members' cards, nested to any depth, on a canvas you pan, zoom and fit, with an overview map (#317).
  The teammates in no department report to you directly: every view shows them beside the leaders, as your direct reports, rather than under a No department group, so the count over the view matches the cards in it; a message to all leaders reaches them too (#396, #428).
  A card shows its teammate's status, what it runs now and for how long, and, when chosen, its usage, its last message and its model; Cards show chooses the fields for every card, a card's own menu for itself.
  Pointing at a card or reaching it with the keyboard opens its details: status, whom it reports to, model, usage, last words and what it runs now; the chat beside the tree talks to whom you choose under To, a teammate whose name you click or a department's Message; long last words show three lines.
  That chat is a teammate's own Organization chat, with its history and composer, answered by that teammate alone; to a group, one message goes to each member's chat, answered with each one's own settings, and each member's row shows its reply's status and opens its chat (#412).
  View switches between the Tree, a Board and Focus: the Board queues who needs you, with how long ago and what they asked, then the leaders and a column for each department, and lists the Organization chats beside it, with each one's last message and the replies that came while another was open; Focus outlines the departments and their people beside one department or teammate in full, with every activity and its time, over its conversation.
  A card's menu chooses where its teammate's Organization chat works: moves it into a project, attaches a folder, or detaches it, by the chat's usual rules, and the details say where it works (#400).
  Edit structure, in every view, adds, renames and deletes departments, chooses a department's leader, and adds, moves and removes members, asking before a delete or a removal.
  In the Tree it edits every place: it adds a teammate, found by a search over the team and moved from wherever it was, or a department, with its name and an optional leader, any teammate or a new one, under you, any teammate or any department, and moves either anywhere by its menu or by dragging it, refusing a move that would put it under itself before it is sent; a department's leader can be any teammate (#399).
  The view, the collapsed departments and the cards' fields are kept across a restart.
- **Organization:** each organization keeps its own node types, such as Branch, Team or Department, each with a name and an optional icon and color; a new organization has none, and adding its first department adds a Department type, while today's departments become that type in their own organization; a type a department still has can't be deleted, and the views to choose, rename and delete types come in their own change (#442).
- **Organization:** the Tree shows each message moving along its lines between you and your teammates and between teammates: a slow, faint flow of small pulses while it is written, a pulse when it is sent, then a glow on the receiver's card, and an answer that stops fades away (#444).
  A teammate's message to another teammate's Organization chat is written from the moment its send starts, and fades if the send is refused, cancelled or fails.
  Show messages moving in the organization, in TeamRun's settings, turns it off, and the Tree stays still while the system asks for reduced motion.

### Fixed

- **Default teammate:** its row in Teammates now names its model and effort, such as GPT-5 and Extra high, rather than their ids, also when no teammate in the list chooses a model or effort on its provider (#214).
- **Pages:** an error from opening a page in the browser, saving it or copying its path now goes away when you switch chats, rather than staying over the other chat's pages, and one that comes after you switched isn't shown (#216).
- **Pages:** a page's More button now looks pressed while its menu is open, and idle again once the menu closes (#22).
- **Organization:** Show organization opens the first organization you have, under its name, also once My organization is deleted; a teammate placed under another teammate outside any department now says in its details that it reports to that teammate, not to you (#401).
- **Grok's model and effort:** a Grok reply now runs on the model and reasoning effort you chose, rather than Grok's own defaults, and a Plan or Ask chat's Grok starts without its own sub-agents again (#467).
- **Grok after an approved plan:** in an Ask chat, once you approve a Grok reply's plan, TeamRun stops that Grok turn and goes on in the same reply with a new one in Ask, so the chat stays read-only, rather than going on in Default, where it could change files; in other chats Grok takes the chat's own mode from its next turn; when Grok refuses the switch, the reply says so (#447).
- **Grok in an Ask chat:** TeamRun now refuses each Grok tool that doesn't only read, such as an edit or a command, even when your own Grok rules allow it without asking, and the reply says which; a Grok too old to let TeamRun refuse its tools says so instead of running an Ask chat; other chats keep Grok's own rules.
  In every Grok chat, a tool Grok asks about while TeamRun can't answer, such as one past 128 waiting at once, is now refused rather than let run (#460, #480).
- **A shared MCP server on Windows:** the server and what it started now end with TeamRun however TeamRun ends, rather than now and then running on after TeamRun was ended at once; when they can't be ended, TeamRun's MCP watch says so in the provider's log (#443).
- **A Pi teammate switched back to Default:** its next reply runs on Pi's current default model and thinking level, not the ones it ran with before, also after its Pi closed, TeamRun restarted or the default changed (#138).
- **Organization messages:** a message from Organization is now your own message in the teammate's Organization chat, `Organization · <name>`, not one from outside TeamRun, and tells the teammate its department, whether it leads it, and who it reports to (#397).
- **Model lists after the engine restarts:** the composer's model picker, the Teammates view and a chat's members list ask each provider for its models again, rather than showing the lists they had before the engine went away (#387).
- **Rewinding to your own message:** its text comes back to the message box once the rewind dialog has closed, with the caret in the box, and a draft already there is asked about only then, rather than in a second dialog over the first (#156).
- **A reply that fails in a group:** a reply whose failure escapes, such as a failed write as it starts or as it fails, fails only itself, and the other teammates addressed in the same message still answer, rather than all failing with its error; a reply stopped as it fails stays stopped, and its tools and sub-agents still close (#141).
- **A chat's wake that brought nothing back:** a screen reader names the part it opens to `Why no reply came back`, rather than `The message received`, which it never holds (#311).
- **The Projects view's layout:** when its first read fails, a pin, collapse or reorder no longer saves the window's unread layout over the one TeamRun keeps; the change waits, the read is tried again at the next change or resync, or at once for one made while the read was out, and the failure, a failed save or a failed read at a resync is logged (#154).
- **After the engine restarts:** the Tasks panel, the projects' layout, the composer's default, the organization, Pages and each open page, and the title-model setting's models read their state again, rather than showing what they had before the engine went away (#151).
- **A wake turn's mode:** a reply that wakes when a background command ends now runs in the mode the chat holds for it at that moment, for the default responder as for a teammate, rather than in the mode its first reply had; on Grok it switches as the wake begins, and the reply says so when its first steps may have run in the earlier mode, when Grok, started in Always approve, still doesn't ask before its tools, or when Grok refuses the switch (#140, #409).
- **Stop as an answer lands:** Stop pressed just as a teammate's answer arrives stops the change comparison, shows the reply as stopped and lists it among what Stop stopped; a teammate it addressed isn't started, and the reply notes whom it would have handed off to (#142).
- **Moving a chat, or attaching or detaching its folder, while its work runs:** the change is refused with a message naming each background command and helper of the chat still running, or a teammate's background work, rather than moving the folder from under it, which left that work writing in the old folder (#139).
- **The focus after a delete:** deleting a teammate, a chat or a shared MCP server moves the keyboard focus to the next row, or the one before for the last, and to Add, or New chat for a chat whose group is gone, once none is left or the next row went meanwhile, rather than dropping it to the window; a focus the person moved while the delete ran stays where it is (#155).
- **The focus after removing a provider:** a focus the person moved while the removal ran, such as to Add provider, stays where it is, rather than jumping back to a provider row (#388).
- **A reply's approvals:** an approval decided, withdrawn or asked just as a teammate's reply ends no longer puts the ended reply back to Running for good (#143).
- **A chat tab's place:** a chat moved to another project, or from Chats into one, now shows its new project in its tab's breadcrumb, rather than the old one (#152).
- **Claude Code on macOS:** a Claude Code signed in the usual way is listed as signed in, and its turns run, rather than showing `Sign-in required` (#338).
- **A chat's wake:** when work a chat sent to another chat ends, the chat shows a closed row, `Received a message from <chat> ›`, at the top of the reply it starts, rather than a message that read as the other teammate answering there, with the chat's IDs and a hint meant for the teammate; the chat's name opens that chat, and opening the row shows the replies; a wake that started no turn shows why below its row, one whose work never came back reads `No reply came back from <chat> ›`, and wakes from earlier versions show as the same row; deleting a chat whose replies already came back no longer drops them: they are delivered as received from a deleted chat and start the asking chat's turn (#296).
- **A sub-agent's or command's wake:** when a sub-agent or a background command of a chat ends and wakes it, the chat shows a closed row naming the work and how it ended, such as `Sub-agent "Search" ended as completed ›`, rather than a message with its IDs; opening the row shows its summary or the command's last lines, and one TeamRun restarted before says it was stopped or didn't come back (#300).
- **A chat's mentioned teammate:** a chat whose next answer goes to a teammate, after a message that mentions one, keeps that teammate when you open another chat or the new chat, or come back to it; the composer's settings no longer replace it with the default teammate, and a mode picked there is that teammate's mode (#326).
- **Ending a sub-agent's processes on Windows:** a stop, deleting the chat, quitting, a sign-out or the provider's exit ends what a kept sub-agent started even when TeamRun's PowerShell stalls, within seconds rather than leaving it running (#309).
- **Editing a waiting message:** an edit whose mentions aren't the teammates its new text names is refused when it's made, and the message stays as it was, rather than being saved and failing later as changed mentions when it's sent (#371).
- **A rewind that can't remove its messages:** when the files were already restored, the rewind's error says so, that the messages were kept and why, and rewinding again removes them, rather than showing only the database's error (#164).
- **Adding a waiting message:** a message whose mentions aren't the teammates its text names is refused when it's added, rather than waiting and failing later as changed mentions when it's sent (#379).
- **Ending a shared MCP server on Windows:** when the launcher of a shared MCP server ends, what the server started is ended even when the PowerShell that lists it stalls, within seconds, rather than left running (#383).
- **Ending a process tree on Windows:** a process whose end failed is ended again while the tree's listing still shows it, in each of the stop's ten rounds, rather than left running after its first end, and each end waits for the process to exit, all of a round's within two seconds (#344).
- **A provider's tool install and the ACP agents' Add and Remove:** a tool install that fails after Install closed the provider dialog, and an Add or Remove that fails after the ACP agents dialog closed, show their failure in a notice rather than nowhere (#153).
- **Questions a teammate posts:** an answer to a secret question it posts is neither kept nor sent as the next message, as for the questions a turn waits on (#229).
- **Chat titles:** a long first message that starts with emoji gets a title that ends in whole emoji and an ellipsis, rather than a broken character (#229).
- **Background tasks:** a task that writes a flood of output within a tenth of a second sends the window only its latest 65,536 characters, the most a task keeps, rather than all of it at once (#85).

### Changed

- **The first launch's Skip for now and Continue:** they sit in a footer along the Providers tab's bottom edge, so they stay in view on a short window while the providers scroll above them (#350).
- **A served call's approval card:** under its title, a card for a Git, GitHub or other module call that TeamRun serves names the module, the tool, the teammate and its chat, such as `Git · git_commit · Codex in "Gemini folder trust"`, as the approved design draws it (#19).
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
