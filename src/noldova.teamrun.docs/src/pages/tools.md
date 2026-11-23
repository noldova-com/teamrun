# Tools teammates use

Each teammate has its provider's own tools, such as its shell and file editing.
TeamRun adds tools of its own that every teammate gets, on every provider: terminals you can see, a browser page, computer use, Git and GitHub, and tools to work with TeamRun itself.
You can also share MCP servers with your teammates.

What a teammate may do with these tools without asking you follows the chat's permission mode; see [Chats and teammates](chats.md#permission-modes) and [Following and approving the work](approving.md#permission-requests).

## Terminal

### The chat's terminals

A chat has terminals of its own.
**New chat terminal**, Ctrl+Alt+\` (Cmd+Alt+\` on macOS), opens one for the chat on screen, in its folder.
A chat's terminals show only while that chat is on screen; switching chats hides them and their shells keep running.
Deleting the chat closes them, and quitting stops them.

A teammate's terminal tools run commands in the chat's terminals, where you can watch them.
Each shows as a step, such as "Run in *terminal*", with the command and its output.

### Run a reply's commands

A reply's shell code blocks (bash, sh, shell, zsh, powershell, pwsh or cmd) offer **Run** once the reply has stopped streaming.
Nothing runs until you press it.
Your own messages offer none.

The run opens where a setting says:

- **Chat**, the default: in a terminal inside the chat, under the block.
- **Terminals panel**: in a terminal tab.

When the chat's terminal is busy, the block asks: **Stop it and run** sends Ctrl+C and runs it, and **Run in a new terminal** uses another terminal.
Ctrl+\` in the chat's terminal goes back to the message box.

An earlier block keeps its run's output after the next run, also after a restart, up to 8,000,000 characters a chat.
That output is yours only: no teammate reads it.

A block runs in any installed shell of its kind, such as Git Bash on Windows or Zsh on Linux.
With none installed, the run is refused with a message naming the kinds.

### Background commands

A teammate can run a command in the background, unseen, in the chat's folder.
It shows in the **Background tasks** panel, with its output and a Stop, and wakes the chat when it ends.
It asks you where the chat's mode asks for commands, and is refused in a read-only mode.
A chat runs at most 4 such commands at once.

## Browser

Each chat has its own Browser page, which its teammates drive.
The top bar's Browser button, or the command **Open the chat's Browser page**, opens it.
**Open browser** in the Projects view opens a Browser tab of your own.

A Browser step says what it did, such as `Opened docs.example.com/pricing` or `Clicked "Choose Team"`, and opens onto the page and a screenshot.
Reading a page, opening a page on a site the project allows, and screenshots go ahead without asking.
Clicks and typing always ask, and a card can offer **I'll type it myself**, so you type into the field yourself.

## Computer use

Computer use lets a teammate see the screen and use apps.
It works on Windows and macOS only, while its preview setting is on.
Linux has none.

While a teammate controls the screen, a border in your accent colour goes around every display; computer use's own setting turns the border off.

A teammate asks for the screen, or for one app, with **Allow in this chat**.
The access then stays for that teammate in that chat; another chat asks again.
The **Computer use** page, from TeamRun's Settings page or the View menu, lists each access you gave, with its app, chat, teammate and when, and **Revoke** takes one back.
Deleting a chat revokes its access.

Codex's own computer use and browser tools are off in TeamRun, so a Codex teammate uses TeamRun's.

## Git and GitHub

Teammates get Git tools in the chat's folder: status, diff, log, branches, stage, unstage, create and switch a branch, commit, push and pull.
Changes such as a commit or a push ask you by their risk.

With the GitHub module, they can also read issues and pull requests, read a pull request's checks, and create a pull request.

## TeamRun's own tools

Teammates can work with TeamRun itself:

- **Chats and projects:** list, open, create, rename, move and delete chats; list and open projects; add a teammate to a chat or remove one.
- **Messages:** read a chat's messages, and send a message to another chat, which starts the teammate there.
- **Teammates and providers:** list them, check a provider's sign-in, and add, change or delete a teammate.
- **Panels:** open or close the Teammates or Providers page, a chat, its Browser page, or a panel such as Changes, Plan or Background tasks.
- **Pages and canvases:** show an HTML file from the chat's folder as a page, edit it, and arrange pages on a canvas.
- **Sub-agents:** start an explorer, which only reads, or a helper, which works in the chat's folder.

Tools that only read never ask.
Sending a message, stopping another chat's replies, removing a teammate from a chat, and changing a teammate ask at medium risk; deleting a chat, forgetting a project and deleting a teammate ask at high risk.
These cards offer only **Allow once** and **Deny**.

An explorer runs only on Claude and Pi, whose read-only mode TeamRun can rely on.
Codex runs none, since your own Codex rules could let a command run outside its read-only sandbox.
Only one helper works in a folder at a time; a second waits its turn.

### Pages

A page a teammate shows opens as a tab.
Its toolbar has Reload, the version and who made it, **Open in the system browser**, **Save as file**, **Print or save as PDF**, and More, with **Versions** among it.
A page keeps its last 50 versions.

## Shared MCP servers

The **MCP servers** page, from TeamRun's Settings page or the View menu, has two lists.

### Added in TeamRun

**Add server** adds a server you share with your teammates: a command (stdio), or an address (HTTP) with its headers.
A secret never goes in the command or the address.
Each variable a server needs takes its value from one of two places:

- **From this machine's environment**, the default.
- **Saved secret**: you type the value once, and TeamRun keeps it in your system's secret store.
  The value is never shown again.

An HTTP server can instead **Sign in with OAuth**.
While you're signed in to GitHub, **Add GitHub's server** adds GitHub's own MCP server, signed in with your GitHub account.

A new server is off for every provider.
Its details show a switch for each provider that can take it, and "N can't take it yet" with each reason for those that can't.
Under **Teammates**, each teammate follows its provider, or you add an exception to set it **On** or **Off**.

A change applies from the next session a provider starts.
When a server is left out of a reply, such as for a variable that isn't set, the reply opens with a note saying why.

Saved secrets and sign-ins reach only providers that keep them out of their own files: Claude takes a saved secret for a stdio server only, and Codex and Pi read values only from their own environment.

### From your providers' own settings

Each provider's own MCP servers are listed by provider, with a switch that lets its teammates use them in TeamRun.
Claude's switch also covers the connectors on your Claude account, and Codex's the apps connected to your Codex account.
Antigravity and OpenCode can't list theirs.
Grok runs the servers its own settings turn on, so TeamRun leaves them to Grok.
Some providers can't use their own servers in TeamRun yet, and the page says why.

## Instruction files and memory

A teammate reads your instruction files and memory, and the project's, as the provider's own tool does:

| Provider | Reads |
|---|---|
| Claude | `CLAUDE.md` files, `.claude/rules`, `CLAUDE.local.md`, `AGENTS.md` where there is no `CLAUDE.md`, and the project's memory. A project's settings load only in a folder Claude Code trusts. |
| Codex | `AGENTS.override.md` or `AGENTS.md` in your Codex folder, then each `AGENTS.md` from the repository's root down. Its memories, while you have them on. |
| GitHub Copilot | `copilot-instructions.md`, `.instructions.md` files, `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`. Copilot Memory doesn't reach a TeamRun chat. |
| Cursor | `.cursor/rules`, `AGENTS.md` and `CLAUDE.md`. Its User Rules are a setting of the Cursor app, and it keeps no memories. |
| Grok | Your own Grok home's instruction files, rules and memory, then the project's files. |
| Antigravity | `AGENTS.md`, `GEMINI.md` and rules, yours and the project's. TeamRun reads these and passes them in, at most 64K characters a file and 128K in all. |
| OpenCode | `AGENTS.md`, or `CLAUDE.md` or `CONTEXT.md` without one, and the files its own settings name. |
| Pi | `AGENTS.override.md`, `AGENTS.md` or `CLAUDE.md`, in its agent folder and in each folder up from the chat's. |
