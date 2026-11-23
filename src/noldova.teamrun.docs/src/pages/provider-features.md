# What each provider can do

Each provider runs through its own tool, and not every tool offers TeamRun the same features.
This page shows which features each provider has in TeamRun, and why some can't.

Settings' page **What each provider can do** shows the same answers for one provider at a time, with the reason beside each one, and covers each ACP agent you added.
Where a provider can't do something, TeamRun keeps the control in place but turned off, with the reason as its note or tooltip.

Each answer is one of four:

- **Works:** TeamRun offers it for that provider.
- **Can't:** the provider's tool doesn't offer it to TeamRun.
- **Not built yet:** the provider could, but TeamRun doesn't support it for that provider yet.
- **Not checked yet:** TeamRun offers it, but no one has seen it work or fail with that provider yet.

The **Added ACP agent** column is any agent you add from the ACP Registry or as your own command; see [ACP agents](acp-agents.md).

## Features

| Ability | Codex | Claude Code | Grok | GitHub Copilot | OpenCode | Cursor | fx | Antigravity | Pi | Added ACP agent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Run and stop a turn | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Resume a chat | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Rewind within the provider's session | Works | Works | Works | Can't | Can't | Can't | Can't | Can't | Works | Can't |
| Compact the context | Works | Works | Works | Works | Works | Can't | Can't | Can't | Works | Works |
| Images in a message | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Files in a message | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Steer a message into a running turn | Works | Can't | Works | Can't | Can't | Can't | Not checked yet | Can't | Works | Can't |
| Chat title written by the model | Works | Works | Works | Works | Can't | Works | Works | Works | Works | Can't |
| Choose a model | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Choose an effort | Works | Works | Works | Works | Works | Can't | Works | Works | Works | Works |
| Choose a fast speed | Works | Works | Works | Works | Not built yet | Can't | Works | Can't | Can't | Can't |
| Choose a context size | Works | Works | Can't | Not built yet | Not built yet | Can't | Can't | Can't | Can't | Can't |
| Plan mode | Works | Works | Works | Works | Works | Works | Can't | Can't | Can't | Can't |
| Read-only mode | Works | Works | Works | Works | Works | Works | Can't | Can't | Works | Can't |
| Unrestricted mode | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Permission cards | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| TeamRun's approved tools run without asking | Works | Works | Works | Works | Works | Works | Can't | Works | Works | Works |
| The provider asks the person questions | Works | Works | Works | Can't | Can't | Can't | Can't | Works | Works | Works |
| Plan checklist in the reply | Works | Works | Works | Works | Can't | Works | Can't | Can't | Can't | Works |
| Tokens and cost of a reply | Works | Works | Works | Works | Works | Can't | Works | Can't | Works | Works |
| Plan-limit meters | Works | Works | Works | Works | Can't | Can't | Can't | Can't | Can't | Can't |
| Rows for the provider's own sub-agents | Works | Works | Works | Works | Can't | Not built yet | Can't | Works | Can't | Can't |
| A background sub-agent outlives its turn | Works | Works | Works | Can't | Can't | Not built yet | Can't | Can't | Can't | Can't |
| Stop one sub-agent | Can't | Works | Works | Can't | Can't | Can't | Can't | Can't | Can't | Can't |
| Follow and stop background commands | Works | Works | Works | Can't | Can't | Can't | Can't | Can't | Can't | Works |
| TeamRun's explorer sub-agent | Can't | Works | Not built yet | Not built yet | Not built yet | Not built yet | Not built yet | Can't | Works | Not built yet |
| Generated images in the reply | Works | Can't | Works | Can't | Not checked yet | Works | Can't | Works | Can't | Works |
| TeamRun's tools in a turn | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Shared MCP servers, stdio | Works | Works | Works | Can't | Works | Works | Not built yet | Can't | Works | Not built yet |
| Shared MCP servers, HTTP | Works | Works | Works | Works | Works | Works | Not built yet | Can't | Works | Not built yet |
| Switch the person's own servers on | Works | Works | Can't | Works | Works | Can't | Not built yet | Not built yet | Can't | Not built yet |
| List the person's own servers | Works | Works | Works | Works | Can't | Works | Works | Can't | Works | Can't |
| Sign in from TeamRun | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Sign out from TeamRun | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Several accounts | Works | Works | Works | Works | Works | Works | Can't | Works | Works | Can't |
| Show the signed-in account | Works | Works | Works | Works | Not built yet | Works | Can't | Can't | Can't | Can't |
| Install and update from TeamRun | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |

## / commands

Commands you type in the composer starting with `/`.
**/compact** and **/logout** run TeamRun's own compaction and sign-out, so they follow "Compact the context" and "Sign out from TeamRun" above.

| Command | Codex | Claude Code | Grok | GitHub Copilot | OpenCode | Cursor | fx | Antigravity | Pi | Added ACP agent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /compact | Works | Works | Works | Works | Works | Can't | Can't | Can't | Works | Works |
| Commands the provider lists | Can't | Works | Works | Works | Works | Works | Works | Works | Works | Works |
| Other built-in commands | Works | Works | Works | Works | Works | Not checked yet | Can't | Works | Can't | Works |
| Custom commands, prompts and skills | Can't | Works | Works | Not checked yet | Works | Not checked yet | Can't | Can't | Works | Works |
| /logout | Works | Works | Works | Works | Works | Works | Works | Works | Works | Works |

## Why some features are missing

**Claude Code**

- It can't take a message into a running turn: Claude Code answers such a message only after the reply, in a turn of its own that TeamRun doesn't show.

**Codex**

- It can't stop one sub-agent: nothing ends what a sub-agent runs in Codex's sandbox.
- It can't run TeamRun's explorer sub-agent: by Codex's documents, a command a rule allows runs outside its sandbox.
- It runs neither commands it lists for the chat nor your custom prompts: Codex's `/` commands belong to its own terminal app.
  TeamRun runs four of them itself: `/review`, `/fork`, `/rename` and `/archive`.

**GitHub Copilot**

- No rewind, no questions to you, no stopping one sub-agent or a background command, and no generated images: Copilot's connection with TeamRun doesn't offer them.
- A background sub-agent doesn't outlive its turn: Copilot holds the turn open until each sub-agent ends.
- Shared MCP servers that run on your computer: Copilot refuses each one.
- Context size: Copilot offers a longer context only for some models, for the whole program, and TeamRun hasn't been able to check one yet.

**OpenCode**

- No rewind within its session: its connection can only copy the whole session.
- No questions to you, no plan checklist and no rows for its sub-agents: its connection with TeamRun doesn't pass them on.
- Speed and context size: OpenCode keeps both inside each model, and TeamRun doesn't support them for it yet.

**Cursor**

- Each Cursor model comes with one fixed effort, speed and context size, and Cursor refuses any other, so you choose only the model.
- It can't compact its context, rewind, report plan usage or plan limits, or ask you questions: its connection offers none of them.
- It always starts the MCP servers in your own Cursor settings, so TeamRun can't switch them.

**fx**

- No rewind, no compaction, no plan-limit meters, no rows for its sub-agents and no stopping a background command: fx's connection offers none of them.
- No read-only mode: every fx mode keeps every tool.
- It can't ask you questions: fx runs a TeamRun turn as not interactive.
- No plan checklist and no generated images: fx sends only text and tool calls.
- One account per computer, and no account shown: fx keeps everything in one folder in your home folder, and doesn't name the account.
- TeamRun's approved tools still ask: fx names a tool in a way another server's tool could also take.

**Antigravity**

- No rewind or compaction: its server offers neither.
- No plan mode: its `/plan` is a command, not a mode, and doesn't wait for your approval.
- No plan checklist: its server sends none.
- No shared MCP servers: Antigravity keeps their values in its own session store.
- No account shown: Antigravity doesn't name the account.

**Pi**

- No plan mode and no rows for its sub-agents: Pi leaves them out by design.
- No speed and no context size choice: Pi names no speed, and each model's context is fixed.
- No plan checklist and no generated images: Pi's replies carry only text, thinking and tool calls.
- No account shown: Pi names only the provider and the kind of sign-in.
- Pi has no permission system, so its modes, **Ask first**, **Read only** and **Allow all**, are TeamRun's own.

**Grok**

- No context size choice, and TeamRun can't switch your own MCP servers on for it.

**Added ACP agents**

- No speed, context size, plan-limit meters, sub-agent rows or account: the agent connection names none of them.
- No rewind: the agent connection can only copy a whole session.
- No plan or read-only mode: the agent connection gives no mode a meaning TeamRun can rely on.
- One account each: an agent runs with the one sign-in it keeps in your home folder.
- **Compact the context** works only for an agent that lists `/compact` and reports that it compacted.

GitHub Copilot, OpenCode, Cursor, Antigravity and added ACP agents can't take a message into a running turn: their connection has no way to add a message to a turn that is already running.
