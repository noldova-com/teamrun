# Conversations

**Scope:** The `conversations` module: threads, their timeline of messages, tool calls, plans, diffs and permission requests, the composer, and the answers to every permission request, under the [architecture's module rules](../../../docs/ARCHITECTURE.md#4-modules).

## 1. Purpose

Conversations are TeamRun's center, and the module is in every release.
A thread is where the person writes and one or several agents reply, tied to a local folder or to none.
The module keeps the threads, starts and prompts their agents through the [providers module](../providers/README.md), stores what each agent session reports, and shows it as one timeline.
It answers every permission request, the agents' and the tool modules', with one card and one policy.

The module sees agents only through the providers module's [event schema](../providers/README.md#the-event-schema), never through a provider's own format.

## 2. Parts and dependencies

- **Protocol:** the models of threads, timeline entries, drafts and attachments, and the messages between the module's parts.
- **Runtime:** the database, the threads and their folders, the agent sessions and their prompt queues, the stored events, and the answers to permission requests.
- **Window:** the Conversations view, the thread document with its timeline and composer, and the module's settings ([Contributions](#4-contributions)).

The module depends on `providers`, for the service `providers.agents` and the schema's models in its protocol package.
It never imports a tool module: each session's MCP connections come from the tool module contract (teamrun#775), and the module passes them to `providers` when it starts the session.

From the shell, the runtime part needs:

- its database, with its migrations, and its module folder, for attachments;
- `getWorkFolderAsync`, for the folders of threads without one of their own;
- notifications, settings, protocol methods and events;
- the runtime permission contract, desktop-core#14, to receive every permission request and return the person's decision.
  The shell does not offer it yet; until it does, the agents' approval requests are denied by `providers` and no card shows.

The window part needs the kit's virtual list and the controls in [Kit controls](#kit-controls).
Turns are active work, which `providers` reports; the module reports none of its own.

## 3. Published API

The module publishes no service yet.
The window part reaches the runtime part through the module's own methods and events ([Contributions](#4-contributions)).

## 4. Contributions

- **View:** `conversations.threads`, the Conversations view, in the left dock by default: the threads, newest activity first, through the kit's virtual list, with a filter by title, the archived threads behind a toggle, and New conversation.
  Each row shows the title, the folder's name or No folder, the agents' accents, a working mark while a turn runs and a badge while a request waits.
- **Document:** `conversations.thread`, one per thread, with the thread's id as its instance.
  Its title is the thread's title; its breadcrumb is the folder's name, or No folder.
  It holds the timeline and, below it, the composer.
  Its tab shows the working mark while any of its agents runs a turn.
- **Commands:** `conversations.newThread`, `conversations.openThread` with the thread's id, `conversations.cancelTurn`, `conversations.nextRequest`, which selects the thread's next waiting card, and `conversations.focusComposer`.
  Default keys come with the design pass.
- **Notifications:** `conversations.requestWaiting`, `conversations.turnFinished` and `conversations.sessionFailed` ([Notifications](#notifications)).
- **Settings**, on a Conversations page, all `Shared`:
  - `conversations.sendKey`, a `Choice` between Enter, the default, with Shift+Enter for a new line, and Ctrl+Enter, Cmd+Enter on macOS, with Enter for a new line;
  - `conversations.reasoning`, a `Choice` between Collapsed, the default, and Hidden.
- **Methods and events:** the window part's reads by range of threads, entries and a call's output; creating, renaming, archiving and deleting threads; sending, editing and withdrawing queued prompts; cancelling a turn; answering a request; and saving drafts and attachments.
  The events `conversations.threadsChanged` and `conversations.entriesChanged` report what changed by position, with the appended text of a streaming entry, so an open timeline updates without reading the entry again.

## 5. Data

The database is `modules/conversations/conversations.sqlite` ([architecture](../../../docs/ARCHITECTURE.md#7-state-and-persistence)).

| Record | Holds |
|---|---|
| Thread | Its id, a UUID; its title; its folder or none; when it was created and last active; whether it is archived; the agent last addressed |
| Folder | Its id, a UUID, and its path on each device, for a thread with a folder of its own |
| Agent | Its thread, its command line's id, its display name, its accent, the model and mode the session last reported, the provider's session id when the session can be resumed, and its queued prompts |
| Event | Each event its sessions reported, in the schema's JSON with its version, by session and sequence |
| Entry | The timeline, by thread and position, derived from the events and from the requests of tool modules |
| Output | Each tool call's output, read only when its card expands |
| Request | Each permission request the module showed: its id, its requester, its action, details, risk and options, its state, its decision, and who decided and when |
| Draft | Each thread's unsent text and attachments |
| Attachment | Its id, its name, its media type, its size and its file in `modules/conversations/attachments/<id>` |

### Stored events

A session's events are the authority for its part of the timeline; entries are derived from them.
The module keeps every event of a thread's sessions for as long as the thread exists.
Pieces, `message.chunk` and `tool.output`, are added to their entry's text or to their call's output and recorded in the log by their sequence alone, so the log stays gapless without holding text twice.
An event of a kind or version the module does not know is stored as it came, so a later build can show it.

A call's output is kept up to 4 MiB: its first 2 MiB and its last 2 MiB, with a marker for the size left out between.
Remembered answers belong to the runtime permission contract, not to this module.

### Folders

A thread with a folder keeps it as a folder record, mapped to a path on each device, never as a bare path.
A thread without one works in `work/conversations/<thread id>`, which the runtime part creates when the thread's first session starts.
A folder missing on this device is reported for the person to find again, never treated as empty, and the thread's agents cannot start until it is found.

### Migrations

Migrations are the fixed, ordered list the architecture requires.

- A migration that changes how entries derive from events marks the affected threads for rebuilding.
  After activation the runtime part rebuilds them from their stored events in short batches, a thread the person opens first, and the thread shows its history as loading until its rebuild ends.
- Reading a stored event of an older schema version goes through the providers protocol package, which reads every version it has written ([Versioning](../providers/README.md#versioning)).
- A stored event of a newer major version than the build knows leaves its thread read-only, with a notice, and nothing is changed or removed.

### Deleting

Archiving hides a thread and keeps everything.
Deleting a thread is the person's request, which asks first: it removes the thread's records and its attachments, and, when the person also chooses it in the same question, the folder TeamRun created for a thread without one.
It never touches a folder the person chose.

### What stays on the device

The thread document's scroll position, as the entry at its top and an offset, is kept per device and window as view state.

The log records ids, kinds, counts and states, never a title, a prompt, a reply, a tool's input or output, an attachment's name or a path.

## 6. Behavior

### Threads

New conversation asks for a folder, or none, and for the first agent.
A thread's title is the first line of its first prompt, cut at 80 characters, until the person renames it; no model is asked for a title.
A thread's folder does not change once its first session has started.

### Agents in a thread

A thread has one or more agents, each one agent session of a command line from `providers`.
The composer offers the command lines `providers` reports as `signedIn`; the others show their status and open the Agents document.

- Each agent gets an accent, from the kit's keys `author-1` to `author-8`, in the order it joined the thread, so up to eight agents in a thread never share one.
- A prompt goes to the agents the person picks in the composer, the agent last addressed by default.
  Each picked agent runs its own turn in its own session, at the same time as the others, and their entries interleave in the order they arrive, each under its author.
- An agent's session holds only its own context.
  When a prompt goes to an agent, the module adds the other agents' replies since that agent's last turn, as quoted plain text under each author's name, up to 64 KiB, keeping the newest when there is more.
  Reasoning, tool input and output are never added.
  The person's message shows how many replies it carried to each agent.
- When another agent already runs a turn in the same folder, the composer says so before sending; it does not block.
- A session starts with its agent's first prompt, never when the thread opens.
  It ends after 15 minutes without a running turn, when the thread is deleted, or when the runtime stops.
  The next prompt resumes it through `providers`, with the provider's session id the agent keeps; when it cannot be resumed, a new session starts, and the timeline says that the agent starts without its earlier context.

### Prompts and turns

`providers` refuses a prompt while a turn runs, so the module queues prompts per agent.

- A queued prompt shows as the person's message marked queued, which the person can edit or withdraw until it is sent.
- Queued prompts go in order, each when the agent's turn finishes `completed`.
- Cancelling a turn, from the composer's stop button or `conversations.cancelTurn`, cancels it through `providers` and pauses the agent's queue; the composer then offers to send the next prompt.
- A turn that finishes `refused`, `limitReached` or `failed` pauses the queue the same way.
- Retrying a failed reply queues its prompt again to the same agent.

### The timeline

The timeline is one list of entries per thread, through the kit's virtual list, which the window part feeds by range ([architecture](../../../docs/ARCHITECTURE.md#long-collections)).
Entries take positions in the order the runtime part receives what they show; a session's events keep their sequence order.

| Entry | From | Shows |
|---|---|---|
| The person's message | The composer | Its text, its attachments and the agents it went to |
| The agent's reply | `message.*` with the kind `reply` | A message control, streaming until `message.finished` |
| Reasoning | `message.*` with the kind `reasoning` | A collapsed block in the agent's turn, or nothing, as `conversations.reasoning` chooses |
| A tool call | `tool.*` | A tool-call card ([Tool calls](#tool-calls)) |
| A subagent | `agent.started` to `agent.finished` | Its events as calls nested under the call that started it |
| The plan | `plan.updated` | One plan per turn, a checklist updated where it first appeared, with its progress, such as 3 of 7, in the composer while the turn runs |
| A diff | `diff.reported` | A diff view in its call's card, or as its own entry when no call made it |
| A permission request | The runtime permission contract | A permission card ([Permissions](#permissions)) |
| The turn's end | `turn.finished` | Its outcome when not `completed`, and the usage reported: tokens, the duration and the cost |
| A notice | `session.*`, `error.reported` | An agent joining, its model or mode changing, a session ending other than by its owner, and errors, with whether the agent can go on |

- Consecutive entries of one author share one header.
- While the person is at the end of the timeline, it follows new entries; once they scroll up, it stays, and Jump to latest shows with the count of new entries.
- A message's text, the person's and the agents', renders as Markdown through the kit's message control: CommonMark with tables, strikethrough, read-only task lists and autolinks, with no raw HTML and no remote images.
  Images show only as attachments, with previews the runtime part supplies.
- A link opens through `openLinkAsync`, which opens only `http`, `https` and `mailto` links; anything else shows as text.
- Strings are English; times show through `Intl` in the application's locale, relative, with the absolute time on hover and focus.

A consumer's rules from the schema apply ([Versioning](../providers/README.md#versioning)): an unknown informational kind is stored and skipped, an open field's unknown value shows as its fallback, and an unknown major version or a closed field's unknown value fails the session closed.
A gap or a repeat in a session's sequence also fails it closed: the module logs it, ends the session and shows the agent stopped with an error.
An agent's output is data: it cannot answer a request, pick a recipient, run a command of TeamRun's or change a setting.

### Tool calls

Each call shows as a tool-call card, collapsed by default, and a failed one expanded with its error.

| Schema | Card |
|---|---|
| Category `command`, `fileRead`, `fileEdit`, `search`, `web` | Kind run command, read, edit, search, fetch |
| Category `mcp`, `subagent`, `other` | Kind other, with the tool's name, and nested calls for a subagent |
| `tool.started` | Running, with the title and the files or command it names as its target |
| A waiting `permission.requested` | Waiting for permission |
| Status `succeeded`, `cancelled` | Succeeded, cancelled |
| Status `failed`, `refused` | Failed, with refused as its error for `refused` |

The card's output loads when it expands, from the stored output, and then follows the call's stream while it runs.
A diff a call made shows inside its card as a read-only diff view, unified or side by side.
A line comment the diff view asks for puts the file and line, as `path:line`, into the composer.

### Composer

The composer is the thread document's input: its text, its attachments, the agents it sends to, and the model and mode of each, which it shows as the session reports them.

- It sends with the key `conversations.sendKey` chooses; while the picked agent's turn runs, sending queues the prompt.
- Attachments come by paste, drop or a file button: images in PNG, JPEG, GIF or WebP, and other files, up to 10 per message and 10 MiB each.
  The runtime part checks each image's type from its content, never its name, refuses SVG and any other type, and keeps the file under its id.
  The window part sends it in pieces under the frame limit and shows its progress.
- The draft, its text and attachments, is saved after a pause of a second and through the window's save step at close, and comes back when the thread opens.
- The composer is disabled, saying why, when no agent can start, or when the thread's folder is missing on this device.
- It shows how many requests wait in the thread, and selecting that shows the next one.

How attachments reach each command line is a [missing decision](#7-missing-decisions).

### Permissions

The module answers every request of the runtime permission contract, desktop-core#14, as `providers` and the tool module contract (teamrun#775) agree.

- **Where a request shows:** an agent's own request, which `permission.requested` ties to its call, shows right under that call's card.
  A tool module's request names the agent session from the session's own MCP connection, and shows in that session's thread at the position it arrives.
  A request that names no session shows nowhere yet, so it expires as denied ([Missing decisions](#7-missing-decisions)).
- **The card:** the requester, the action, its description, the risk as text and icon, the exact details as code, and the options the request offers.
  The card's default option is Allow once at low risk and Deny at medium and high risk.
  Always allow at high risk asks for an inline confirmation.
- **States:** pending, with the request's expiry time; sending, with the options disabled; failed to send, with a retry; and, once decided, the outcome in place of the options, with who decided and when: allowed once, always allowed, denied, always denied, expired or withdrawn.
  A request the contract answers from a remembered answer shows as a decided card that names the rule.
  Cancelling a turn withdraws its waiting requests.
- **Focus:** a card never takes focus by itself; `conversations.nextRequest` and the composer's count select it, and the kit's list marks it selected.
- **Authority:** only the person's choice in the window part answers a request.
  The runtime part checks that the request waits and that the option is one it offered, and returns the decision to the contract, which records it.

### Notifications

The runtime part posts a notification when the thread it concerns is not in view, or the window is not focused:

- `conversations.requestWaiting`, when a request waits;
- `conversations.turnFinished`, when a turn ends;
- `conversations.sessionFailed`, when a session ends `failed` or a turn finishes `failed`.

Opening one runs `conversations.openThread` and selects its entry.
No notification answers a request; the person answers on the card.

### Screens and states

The design pass, from Oct 16, covers these screens and their states, in every theme and mode, at the smallest window and at 200% zoom:

- **The Conversations view:** loading, no threads, the list, no filter results, archived threads, and a row while a turn runs, while a request waits and while its folder is missing.
- **New conversation:** choosing a folder or none, choosing the first agent, and no command line found or none signed in.
- **The thread document:** history loading or rebuilding; an empty thread; a streaming reply; reasoning collapsed; tool calls in every status, with output loading, long and nested; the plan; a diff in a card; permission cards in every state, a high-risk one and several waiting; each turn outcome with its usage; notices, including an agent starting without its earlier context; several agents interleaved with their accents; Jump to latest; a missing folder; and a read-only thread.
- **The composer:** empty, multi-line, attachments with previews, progress and refusals, several agents picked, queued prompts, a running turn with its stop button, paused after a cancelled turn, disabled with its reason, another agent running in the folder, waiting requests and a restored draft.
- **Notifications:** a request waiting, a turn finished and a session failed.

### Kit controls

The window part uses these kit controls:

| Control | From | Used for |
|---|---|---|
| Virtual list | The kit | The timeline and the thread list; the list owns the busy state while a message streams, and its selection is single and set by the module |
| Message control | components#36 | The person's and the agents' messages, with author accents `author-1` to `author-8`, attachments and child controls |
| Tool-call card | components#37 | Tool calls, with output loading on expand through its output request |
| Diff view | components#38 | Diffs, read-only, without word-level highlights or comments; its line comment request only emits its event |
| Permission card | components#39 | Requests; the module sets its expired, sending and failed states |
| Code block, text input, buttons, menus and badges | The kit | The composer, details and actions |

The composer, the plan checklist, the thread rows, the turn's end and the notices belong to the module, built from kit tokens under the [UI standards](../../../docs/UI-STANDARDS.md#9-the-shared-kit-and-modules).

## 7. Missing decisions

Resolve these before dependent implementation:

- **Permission contract:** desktop-core#14's request and decision shapes, the scopes of remembered answers and which the card offers, and where a request that names no agent session shows.
- **Tool connections:** how the tool module contract, teamrun#775, gives each session its MCP connections, which the module passes to `providers`.
- **Prompt content:** how images and files reach each command line, and their sizes, which the providers module decides ([Missing decisions](../providers/README.md#7-missing-decisions)); until then the composer offers no attachments.
- **Models and modes:** how the person picks an agent's model and mode, which the providers module decides; until then the composer shows what the session reports.
- **Choosing a folder:** the window offers no folder chooser to a window part yet, so New conversation can offer only No folder until the shell offers one.
- **Working folders:** whether this module or a projects module owns folder records and publishes the stable identity checkpoints needs ([checkpoints](../checkpoints/README.md#5-missing-decisions)).
- **Reviewing diffs:** accepting and rejecting hunks writes the working folder, which waits for checkpoints' restore and conflict rules; until then diffs are read-only.
