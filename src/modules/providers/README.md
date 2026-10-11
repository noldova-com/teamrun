# Providers

**Scope:** The `providers` module: the agent command lines TeamRun runs, their adapters, and TeamRun's agent event schema, under the [architecture's module rules](../../../docs/ARCHITECTURE.md#4-modules).

## 1. Purpose

TeamRun runs coding agents from several providers, each through the provider's own command line.
This module finds the installed command lines, shows whether the person is signed in to each, starts and stops agent sessions, and turns each command line's stream into one schema of TeamRun's own.
Other modules, first of all conversations, see agents only through that schema and never through a provider's format.

The schema follows the Agent Client Protocol's shapes ([The event schema](#the-event-schema)), with TeamRun's own adapters and no package of the protocol's.
Each command line gets one adapter, of the kind its stream needs, which knows that command line's stream and nothing else.

## 2. Parts and dependencies

- **Protocol:** the schema's models, its version and the messages between the module's parts.
- **Runtime:** discovery, sign-in status, the agent sessions, their processes and the adapters.
- **Window:** the Agents document and the module's settings ([Contributions](#4-contributions)).

The module depends on no other module.
Conversations depends on it.
The module never imports a tool module: the MCP servers an agent session reaches come from the caller that starts the session ([Sessions](#sessions)).

From the shell, the runtime part needs:

- `startProcessAsync`, with the program's standard input, output and error as streams, to run every command line;
- `beginWork`, to report each running turn as active work (architecture, [section 9](../../../docs/ARCHITECTURE.md#9-active-work-closing-and-shutdown));
- `publishService`, for the [published API](#3-published-api);
- its module folder, for each session's generated configuration;
- settings, protocol methods and events, for the window part;
- the runtime permission contract, desktop-core#14, to raise the permission requests of agents' own tools and receive the decisions.
  The shell does not offer it yet; until it does, the adapter denies every approval request to the command line and reports it, so nothing an agent asks to do runs unapproved.

## 3. Published API

The runtime part publishes the service `providers.agents` to the modules that depend on it.

- **Command lines:** list each supported command line with its [status](#discovery-and-sign-in), and check them again on request.
- **Sessions:** start a session, send it a prompt, set one of its configuration options, such as its model, cancel its running turn and end it.
  A session delivers its events in order to the module that started it, which alone may prompt, cancel or end it.

The window part reads the command lines' status through the module's own methods, `providers.commandLines` and `providers.checkCommandLines`, and follows the event `providers.commandLinesChanged`.

### The event schema

The schema follows the shapes of the [Agent Client Protocol](https://agentclientprotocol.com/protocol/overview), version 1: its session updates, content blocks, tool calls, plans, permission requests and stop reasons keep the protocol's field names and values.
TeamRun uses no package of the protocol's; its protocol package defines these models itself, and every adapter maps its command line's stream into them.
Names of protocols and products belong to their owners, and naming them implies no endorsement.

An event is one JSON object with these fields:

| Field | Holds |
|---|---|
| `version` | The schema's version, `<major>.<minor>` |
| `session` | The TeamRun session's id, a UUID TeamRun gives the session, never the provider's own id |
| `sequence` | The event's position in its session, counting from 1 without gaps |
| `time` | When the adapter read the provider's output, as an ISO 8601 UTC time |
| `turn` | The turn's id, a UUID, on every event of a turn; absent on events of the session itself |
| `agent` | The subagent's id when a subagent produced the event; absent for the session's own agent |
| `kind` | One of the kinds below |
| `data` | The kind's fields |

A session's events form one sequence: `session.started` first, `session.ended` last, and each turn from its `turn.started` to its `turn.finished`, one turn at a time.
Consumers use `sequence` to tell a missed event from a late one and never reorder by `time`.

| Kind | Data | The protocol's shape |
|---|---|---|
| `session.started` | The command line's id and version, the adapter kind, the working folder, `configOptions`, `modes` when the command line gives no configuration options, and the provider's own session id when the session can be resumed | The `session/new` response, with its `configOptions` and its `SessionModeState` |
| `session.update` | `update`: one of the protocol's session updates, below | The `session/update` notification's `update` |
| `session.ended` | The reason: `ended` when its owner ended it, `stopped` when cancelling stopped its process, `exited` when the command line exited by itself, with its exit code, or `failed`, with an [error](#errors) | None: a session ends with its process |
| `turn.started` | The prompt's id, which the session's owner gave it | The `session/prompt` request, without its content |
| `turn.finished` | The outcome: the protocol's `stopReason`, `end_turn`, `max_tokens`, `max_turn_requests`, `refusal` or `cancelled`, or `failed`, with an [error](#errors); and the usage the command line reports: input, output and cached tokens, the duration, and the cost, each absent when not reported | The `session/prompt` response |
| `tool.output` | `toolCallId` and the next piece of the call's output, such as a command's | None ([Differences](#differences-from-the-protocol)) |
| `permission.requested` | The runtime permission request's id, and the request's `toolCall` and `options` | The `session/request_permission` request, without `sessionId` |
| `permission.resolved` | The runtime request's id; its decision: `allowedOnce`, `allowedAlways`, `denied`, `deniedAlways`, `withdrawn` or `expired`; and the `outcome` the command line was sent | The `session/request_permission` response's `outcome` |
| `agent.started` | The subagent's id, the `toolCallId` that started it, and its task's description | None |
| `agent.finished` | The subagent's id and its outcome, as a turn's | None |
| `error.reported` | An [error](#errors) | None |

A `session.update` holds one of the protocol's session updates, by its `sessionUpdate`:

| `sessionUpdate` | Holds | Consumers |
|---|---|---|
| `agent_message_chunk` | A reply's next `content` block and its `messageId` | Show the reply |
| `agent_thought_chunk` | The agent's reasoning's next `content` block and its `messageId` | Show the reasoning |
| `tool_call` | A new call: `toolCallId`, `title`, `kind`, `status`, `content`, `locations`, `rawInput` and `name` when given | Show the call |
| `tool_call_update` | `toolCallId` and the fields that changed; `content` and `locations` replace the call's whole list, and `rawOutput` holds the result | Update the call |
| `plan` | The whole plan's `entries`, each with its `content`, `priority` and `status` | Replace the plan |
| `config_option_update` | The session's whole `configOptions`, each with its `id`, `name`, `category`, such as `model` or `mode`, and `currentValue` | Show the model and mode |
| `current_mode_update` | `currentModeId`, from a command line that reports modes and no configuration options | Show the mode |
| `usage_update` | `used` and `size` of the context in tokens, and the session's `cost` when reported | Show the usage |
| `available_commands_update` and any other | As the protocol defines them | Informational: stored and skipped |

A tool call's `kind` is one of the protocol's `read`, `edit`, `delete`, `move`, `search`, `execute`, `think`, `fetch`, `switch_mode` and `other`, so a consumer can show a call it does not know by name.
Its `status` is `pending`, `in_progress`, `completed` or `failed`; a call that has not finished when its turn finishes `cancelled` is shown as cancelled, as the protocol advises the client, and a call whose permission was denied fails.
A session's model and mode are its configuration options, by their `category`: an adapter whose command line reports them another way, or reports only modes, gives them in these shapes.
A file a call changed is a `diff` item of its `content`, with its `path`, its `oldText`, null for a new file, and its `newText`.
Chunks with the same `messageId` belong to one message; a chunk with another `messageId`, another update or the turn's end ends it.
An adapter whose command line gives whole messages only sends one chunk per message.

A session sends at most 10 message chunks and `tool.output` events a second, together: the text read in between joins the next text chunk of its message or the next piece of its call.
Before any other event, the session sends the pieces it holds, so batching never changes the order of events.
Every text is plain text or Markdown, which the consumer renders under the [secure-coding rules](../../../docs/CODING-STANDARDS.md#8-secure-coding), since agent output is data and never instructions.

Each kind's model validates its fields under the [wire contract](../../../docs/CODING-STANDARDS.md#the-wire-contract).
A text field is bounded at 1 MiB, and an adapter that reads a longer one sends it in pieces where the kind has pieces, and cuts it with a marker where it has not.
A `diff` whose `oldText` or `newText` is over 1 MiB is sent as a `content` item that names the file and says the change is too large to show.

### Differences from the protocol

The protocol connects an editor to a live agent; this schema also records what a session did, for storage and replay, and puts TeamRun's own permission contract between the agent and the person.
Each difference has its reason:

- **One event per record:** events are one-way records in an envelope with TeamRun's session id, a gapless `sequence`, `time`, `turn` and `agent`, where the protocol has JSON-RPC requests, responses and notifications.
  A request and its answer, such as a prompt or a permission request, become two events.
  Stored events must show missed or repeated events, their order and their turn without the live connection.
- **TeamRun's session id:** `session` is TeamRun's UUID, and the provider's own session id appears only in `session.started`, for resuming.
  Every adapter kind gives its sessions the same kind of id, and stored records never depend on a provider's.
- **A `messageId` on every chunk:** the protocol makes it optional; an adapter whose command line gives none makes one, a UUID per message.
  Consumers store and show messages one by one.
- **Batching:** at most 10 chunk and `tool.output` events a second, joining consecutive text, where the protocol sends updates as they come.
  It bounds the cost of rendering and storing a stream.
- **`tool.output`:** a call's output streams as appended pieces, where the protocol replaces a call's `content` with each update or shows a terminal the client runs.
  Replacing the content would send all output again with each piece, and TeamRun does not run the agent's terminals ([Missing decisions](#7-missing-decisions)).
- **Paths relative to the working folder:** a path inside the session's working folder, in `locations` and `diff` items, is relative to it; one outside stays absolute, where the protocol always uses absolute paths.
  Stored records outlive a device's paths, and the architecture keeps records free of them.
- **`failed` turns:** `turn.finished` records `failed` with an error, where the protocol answers the prompt with a JSON-RPC error and no stop reason.
  A stored turn always has an outcome.
- **Usage per turn:** `turn.finished` holds the turn's tokens, duration and cost, beside the protocol's `usage_update` of the session's context and cost.
  The person sees what each turn cost.
- **Permission decisions:** `permission.requested` and `permission.resolved` carry the runtime request's id, and the resolved event keeps both TeamRun's decision and the `outcome` the command line was sent.
  TeamRun keeps remembered answers itself and answers the command line with allow-once ([Permissions](#permissions)), so the two differ.
- **Subagents:** `agent` and `agent.started` and `agent.finished`, which the protocol has no shape for.
  Conversations shows a subagent's calls under the call that started it.
- **Session lifecycle:** `session.ended` and `error.reported`, which the protocol has no shape for.
  A session's process can end or fail outside any request.
- **Resuming:** an adapter that loads an earlier session drops the updates the command line replays, such as `user_message_chunk`.
  Conversations keeps the earlier timeline and the person's messages itself.
- **No prompt content:** `turn.started` holds the prompt's id, not its content blocks.
  The session's owner keeps the prompt, and the schema does not hold it twice.
- **Bounds:** the text bounds above and the [16 MiB line bound](#errors), which the protocol leaves to implementations.

### Versioning

The schema starts at version `1.0`, following version 1 of the protocol.

- A minor version only adds: an optional field, a new value of an open field, or a new kind or session update that is informational only.
  Consumers ignore fields, informational kinds and session updates they don't know, as the schema allows them, and read an open field's unknown value as its fallback below.
- Anything else is a major version: a removed or renamed field, a changed meaning, a new or removed value of a closed field, or a new kind or session update that asks for an answer or changes a turn's outcome.
  A consumer refuses a major version it does not know before acting on any event of it.
- `session.started`, `turn.finished`, `permission.requested` and `session.ended`, and the `tool_call` and `tool_call_update` session updates, are never informational: a consumer that cannot read one fails the session closed.
- Following a newer protocol version is a schema change under these rules: a minor version when the protocol's change only adds what a minor version may add, and a major version otherwise.
  An adapter that speaks a newer protocol version to its command line maps it into the schema's current shapes, so a command line's protocol version never changes the schema by itself.
- Stored events outlive builds, so the protocol package reads every version it has ever written, mapping each older form into the current one.
  Its tests keep the older forms and refuse a newer major.

Each enumerated field is open or closed:

| Field | Open or closed | An unknown value is read as |
|---|---|---|
| `kind` | Open for informational kinds only | Skipped |
| `sessionUpdate` | Open for informational session updates only | Skipped |
| `session.started`'s adapter kind | Open | Shown as unknown; nothing depends on it |
| `session.ended`'s reason | Closed | Refused, failing the session closed |
| `turn.finished`'s and `agent.finished`'s outcome | Closed | Refused, failing the session closed |
| A content block's `type` | Open | Shown as content the build cannot show, by its type |
| A tool call content item's `type` | Open | Skipped |
| A tool call's `kind` | Open | `other` |
| A tool call's `status` | Closed | Refused, failing the session closed |
| A configuration option's `category` | Open | Shown by its `name`, as neither the model nor the mode |
| A plan entry's `priority` | Open | `medium` |
| A plan entry's `status` | Closed | Refused, failing the session closed |
| A permission option's `kind` | Closed | Refused, failing the session closed |
| `permission.resolved`'s decision and its `outcome` | Closed | Refused, failing the session closed |
| An error's code | Open | `providerError`, keeping its message and whether the session can go on |

## 4. Contributions

- **Document:** `providers.agents`, the Agents document, lists each supported command line with its status, its version, the program it found, and the command line's own sign-in command for the person to run in a terminal.
  It checks again on request.
- **Settings**, on a Providers page:
  - an `Action` setting that opens the Agents document;
  - for each command line, a `Device` `Text` setting with an absolute path to its program, empty by default, which replaces the search on the PATH.
- **Methods and events:** `providers.commandLines`, `providers.checkCommandLines` and `providers.commandLinesChanged`, for the window part.

## 5. Data

The module keeps no database.
A session's events go to its owner as they come, and the owner keeps what it needs; the module holds nothing that outlives a session.

A session's generated configuration, such as the MCP servers it may reach, goes in `modules/providers/sessions/<session id>` and is removed when the session ends.
The module creates the folder so that only the person's own account can read it.
A starting runtime removes the folders a stopped one left behind.

The module never reads, copies or stores a command line's credentials or session files.
Its log records event kinds, counts, exit codes and the codes of adapter failures, never prompts, replies, tool inputs, outputs, a provider's error text, arguments or environment.

## 6. Behavior

### Discovery and sign-in

Discovery runs on the first request, never at activation, and again when the person asks or a program path setting changes.

For each command line the module finds the program, as `startProcessAsync` would find it or from its path setting, and runs the command line's own version command.
Its status is one of:

- `notFound`: no program on the PATH or at the set path;
- `unsupported`: a version outside the range its adapter supports, which the status names, or a command line whose approvals cannot be routed to TeamRun ([Permissions](#permissions));
- `signedOut` or `signedIn`, from the command line's own status interface: its status command, or its protocol's account request where the adapter's protocol has one;
- `unknown`: the status interface failed or did not answer within 10 seconds, with the reason.

The module reads only whether the person is signed in, and the account's display label where the status interface gives one, which the Agents document shows and nothing logs.
It never reads credential files, environment values or keychains, and never signs in for the person.

### Sessions

A session is one agent process, started in the session's working folder with the arguments its adapter needs.

- The process gets the environment `startProcessAsync` gives every program, plus the variables its command line's definition names for its own configuration, inherited by name.
  The module never reads their values.
- The session's owner gives the working folder, the model and mode when it chooses them, and the MCP servers the agent may reach.
  The adapter writes them into the command line's own configuration for this session only, in files in the session's folder, never in the person's or the project's configuration.
  The command line's arguments may name those files but never hold their content.
- Whatever identifies or authenticates a session's connection, such as a token or a per-session address, goes only into the session's folder: never into the arguments, the environment, the log or an event, so no other program reads it from the process list.
  It is removed with the folder.
- Each turn is active work while it runs.
- A prompt sent while a turn runs is refused; the owner queues prompts.
- A session is resumed only through the command line's own resume interface, with the provider's session id the session reported in `session.started`, which the owner keeps.

Cancelling a turn asks the command line to stop it through its own interrupt, then waits for its end.
When the command line offers no interrupt, or the turn has not finished within 5 seconds, the module stops the process: the turn finishes `cancelled` and the session ends `stopped`.
The owner may resume a stopped session in a new one.
Cancelling withdraws the turn's pending permission requests.
Ending a session cancels its turn and stops its process; the runtime ends what is left when the module's part deactivates (architecture, [Programs modules run](../../../docs/ARCHITECTURE.md#programs-modules-run)).

### Permissions

Every permission request goes through the runtime permission contract, desktop-core#14, and conversations answers them all with one card and one policy.

- **The agent's own tools:** the adapter turns the command line's approval request into a runtime request from `providers`, with the session, the call and the options the command line offers, and sends `permission.requested`.
  It sends the decision back to the command line in the command line's own terms and sends `permission.resolved`.
  TeamRun keeps remembered answers itself, so an allowed request is answered with the command line's allow-once option, never its allow-always one, and later requests still reach TeamRun.
  A request withdrawn because its turn was cancelled is answered with the protocol's `cancelled` outcome, where the adapter's protocol has one, and denied otherwise; a request that expires is denied with the command line's reject-once option.
- **Tools that tool modules serve:** a tool module raises its own runtime request for its action, under the tool module contract (teamrun#775).
  The request never passes through the agent's stream or this schema, since the MCP server never sees the call's id; conversations shows it as its own entry in the session, placed where it arrives among the session's events received so far, as the [conversations module](../conversations/README.md#permissions) describes.
  Each session reaches the tool modules through MCP connections of its own, so a tool module knows the calling session from the connection, never from the tool's arguments.
  A denied or withdrawn request ends the call with an MCP error result, which the agent's stream shows as a `tool_call_update` with the status `failed`.
- **No double prompt:** for each session the adapter allows, in the command line's own allow configuration, exactly the tools TeamRun serves on that session's connections, so the person is asked once, by the tool module.
  Each allow entry names one served tool by its full name, never by a wildcard, under a server name only TeamRun uses: a name of its own with the session's random suffix, which no configuration written before the session can name.
  It never turns on a command line's global mode that skips approvals, so the agent's own tools still ask.

The person's and the project's own configuration of a command line could pre-allow the agent's tools, turn on the mode that skips approvals, or define a server under one of TeamRun's names, so that requests bypass the runtime contract.
The adapter holds the session against them:

- It starts the command line with an explicit approval mode that sends every approval to TeamRun, and limits the configuration the command line reads to the session's own where the command line offers that, through its own options.
- It checks what the command line reports at the start, such as its approval mode and its MCP servers, where it reports them.
  An approval mode other than the one asked for, or another server under one of TeamRun's names, ends the session `failed` with `configurationConflict` before any prompt.
- It never writes or changes the person's or the project's configuration, not even to remove a conflict.
- A command line that cannot be held to this is `unsupported`, and its status says that its approvals cannot be routed to TeamRun.
  Whether each adapter kind can be held is a blocking [missing decision](#7-missing-decisions).

The agent's output cannot grant a permission, answer a request or widen what a session may reach.

### Subagents

A subagent's events carry its id in `agent`, between its `agent.started` and `agent.finished`.
The call that started it stays open until the subagent finishes.
When a command line shows only a subagent's result, the adapter sends it as a call of the kind `other` and no `agent` events.

### Errors

An error has a code, a message for people and whether the session can go on.
Codes: `commandLineMissing`, `unsupportedVersion`, `signedOut`, `startFailed`, `configurationConflict`, `exited`, `protocolViolation` and `providerError`, the command line's own error, with its message.

- A line or message the adapter cannot read, or one over 16 MiB, is a `protocolViolation`: the turn finishes `failed`, the process stops and the session ends `failed`.
- A provider's error that ends a turn finishes it `failed`; one that does not, such as a retried request, is reported and the turn goes on.
- Messages are redacted as the runtime's log is, and carry no environment value or credential.
  The command line's standard error is read with a bound of 64 KiB per turn and goes only into the error it explains.

### Adapters

An adapter maps one command line's stream into the schema.
There are three kinds, by the stream's protocol; which command line uses which kind is a [missing decision](#7-missing-decisions).
An Agent Client Protocol session already speaks the schema's shapes, so its adapter passes them through with the [differences](#differences-from-the-protocol) above; the other two map their streams into them.

| Concept | Line-delimited JSON stream | JSON-RPC app server | Agent Client Protocol session |
|---|---|---|---|
| Process | One per session, prompts written as JSON lines to standard input | One per session, a JSON-RPC peer on standard input and output | One per session, a JSON-RPC peer on standard input and output |
| Start and version | The stream's init event gives the provider's session id, model, tools and capabilities | An initialize request, then a request that starts or resumes a thread | An initialize request that agrees on the protocol version and capabilities, then a new or loaded session |
| Prompt | A user message line | A request that starts a turn | A prompt request, whose answer ends the turn |
| Messages | Assistant text and thinking blocks, and partial deltas when enabled | Item notifications for agent messages and reasoning, with deltas | Message and thought chunk updates |
| Tools | Tool-use blocks start calls; tool results in the next user message finish them | Item started and completed notifications for commands, file changes and MCP calls, with output deltas | Tool call updates with their status, content and locations |
| Plans | From the agent's plan or task-list tool's input | Plan update notifications | Plan updates, each the whole plan |
| Diffs | From file-edit tool inputs | File change items' patches | Diff content in tool call updates |
| Permissions | A permission tool the module serves on the session's own MCP connection, which the command line calls before each tool it would ask about | Approval requests from the server, answered with a decision | Permission requests with the options to choose from, answered with one |
| Subagents | Events carrying the id of the call that started the subagent | Shown as their parent call when the stream gives no more | Shown as their parent call when the stream gives no more |
| Turn end | The result event, with its usage and cost | A turn completed notification | The prompt's answer and its stop reason |
| Cancelling | The interrupt the command line offers, or stopping the process | An interrupt request | A cancel notification, after which the turn ends `cancelled` |
| Sign-in status | The command line's status command | The protocol's account request | The command line's status command; without one, `unknown` until starting a session reports that authentication is required |

Adapters are tested against synthetic streams written from each command line's public documentation, never against recordings of real sessions, until a decision allows those.

## 7. Missing decisions

Resolve these before dependent implementation:

- **Command lines:** which command lines TeamRun supports, which adapter kind each uses, and the version range of each.
  Integrated command lines may be named by their official names, with the notice that names belong to their owners and imply no endorsement, and no logos; which ones TeamRun launches with waits for the Owner's confirmation.
- **Holding approvals, blocking every adapter:** for each adapter kind, whether its command lines offer the options to set the approval mode and limit the configuration they read, and to report both at the start, so that a session can be held to TeamRun's approvals ([Permissions](#permissions)).
  An adapter kind that cannot be held is not supported.
- **Permission contract:** the runtime permission contract, desktop-core#14, its request and decision shapes and remembered answers; the permission section above follows it once it is defined.
- **Client capabilities:** whether TeamRun serves an Agent Client Protocol session's file and terminal requests itself, or the agent keeps its own.
- **Prompt content:** images and files in a prompt, and the sizes allowed.
- **Models and modes:** how the person and teammates choose a model and mode per command line through its `model` and `mode` configuration options.
- **Live use:** running real command lines and recording real streams for tests, which the Owner decides.
