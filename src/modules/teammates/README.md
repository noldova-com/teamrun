# Teammates

**Scope:** The `teammates` module: the named agents the person defines, each with a role, a command line and a model preference, which a conversation brings in, under the [architecture's module rules](../../../docs/ARCHITECTURE.md#4-modules).

## 1. Purpose

A teammate is an agent the person names and gives a role, such as a reviewer who checks every change against the project's rules.
The person creates, edits and deletes teammates, and brings them into a conversation, where each replies under its own name.
The module keeps the teammates; the [conversations module](../conversations/README.md) runs them, as agents of its threads, through the [providers module](../providers/README.md).

## 2. Parts and dependencies

- **Protocol:** the teammate's model and the messages between the module's parts.
- **Runtime:** the database and the published API.
- **Window:** the Teammates document and the module's setting ([Contributions](#4-contributions)).

The module depends on `providers`, for the command lines and their status.
Conversations depends on this module.

From the shell, the runtime part needs its database, with its migrations, `publishService`, settings, protocol methods and events.

## 3. Published API

The runtime part publishes the service `teammates.directory` to the modules that depend on it.

- **List** the teammates that are not deleted, by name.
- **Read** one teammate by its id, deleted or not, so a thread that holds a deleted teammate still names it.
- **Follow** changes: a teammate created, edited, deleted or restored, by its id.

The service only reads; teammates change only through the Teammates document, which is the person's.

## 4. Contributions

- **Document:** `teammates.teammates`, the Teammates document: the teammates by name, each with its command line's status from `providers`, and New teammate.
  It opens a teammate to edit, and holds the deleted teammates behind a toggle, each with Restore.
- **Commands:** `teammates.open`, which opens the Teammates document, and `teammates.create`, which opens it on a new teammate.
- **Settings:** on a Teammates page, an `Action` setting that opens the Teammates document.
- **Methods and events:** the window part's list, read, create, edit, delete and restore, and the event `teammates.changed`.

## 5. Data

The database is `modules/teammates/teammates.sqlite`, under the [architecture's storage rules](../../../docs/ARCHITECTURE.md#7-state-and-persistence), as the conversations module's is.

| Field | Holds |
|---|---|
| Id | A UUID, never reused |
| Name | What the timeline, the composer and the Teammates document show: 1 to 64 characters, trimmed, unique among the teammates not deleted without regard to case |
| Role | The person's free-text instructions for the teammate, up to 16 KiB, plain text |
| Command line | The id of a command line `providers` supports |
| Model preference | The model the teammate asks its command line for, as the command line names it, up to 128 characters, or none for the command line's own default |
| Created, edited | When, as ISO 8601 UTC times |
| Deleted | When the person deleted it, or none |

Every write validates these bounds under the [wire contract](../../../docs/CODING-STANDARDS.md#the-wire-contract) and keeps the record whole: a create or an edit writes every field in one transaction.
The teammates are shared by every device on the data directory; nothing is kept per device.

Deleting a teammate sets when it was deleted and keeps the record whole, so Restore brings it back as it was.
A restored teammate whose name another teammate took meanwhile is restored only once the person renames it.
Nothing removes a deleted teammate for good; removing one waits for a [retention policy](#7-missing-decisions).

The log records ids and counts, never a name, a role or a model preference.

## 6. Behavior

### Creating and editing

New teammate asks for the name, the role, the command line and the model preference, none by default.
The command line is any one `providers` supports, whatever its status, so a teammate can be prepared before its command line is installed or signed in to; the Teammates document shows that status beside it.
The module checks only the model preference's bounds: whether the command line knows the model shows when a session starts, as a `startFailed` error that names the teammate to edit.

An edit changes the teammate for every thread that holds it:

- its name shows everywhere at once, in the timeline's past entries too;
- its role takes effect at its next prompt in each thread, never in a running turn;
- its command line and model preference take effect when each thread's agent next starts or resumes its session, never in a running one ([In a conversation](#in-a-conversation)).

### In a conversation

The conversations module's composer offers the teammates whose command line `providers` reports as `signedIn`, and, for each such command line, a plain agent without a role.
A teammate whose command line has another status shows that status and cannot be picked.

- A teammate joins a thread once, as one of its agents; its accent comes from the thread, as conversations assigns it ([Agents in a thread](../conversations/README.md#agents-in-a-thread)).
- The thread's agent keeps the teammate's id, and reads its name from this module, so a rename shows in every thread.
- Each session of a teammate starts with its command line and model preference as they are then.
  When the teammate's command line changed since the agent's last session, the agent drops the provider's session id it kept, takes the teammate's new command line, and starts a new session, and the timeline says that the agent starts without its earlier context, as for a session that cannot be resumed.
  A changed model preference keeps the session: the agent resumes it and sets the session's `model` configuration option to the new model, and where the command line keeps the earlier model on resuming, the timeline shows the model the session reports.
- Its role reaches the agent as the opening part of each session's first prompt, as quoted text marked as the teammate's instructions, since every command line takes a prompt and not every one takes added instructions.
  When the role changed since it last reached the session, whether the session stayed open between turns or was resumed, the next prompt opens with the new role marked as updated instructions.
  The person's message shows that it carried the role, which opens on request.
- A deleted teammate stays in the threads that hold it, named as deleted.
  It cannot be addressed until it is restored, and its running turn, if any, goes on to its end.
  Its queued prompts are held, marked as held, until it is restored, and the person can withdraw them meanwhile.

A role is the person's own text, but it reaches the agent as part of a prompt: it can ask the agent to behave a certain way and grants nothing.
A teammate's tool calls ask for permission as any agent's do, and the conversation's answers apply to it ([Permissions](../conversations/README.md#permissions)).

### Out of the first release

The first release creates, edits, deletes and restores teammates, and picks them in a conversation.
These stay out of it:

- sharing teammates with other people, or with devices outside the data directory, and exporting or importing them;
- permissions of a teammate's own, beyond the conversation's;
- tools, MCP servers, working folders or settings of a teammate's own;
- avatars and colors of a teammate's own, beyond the accent its thread gives it;
- removing a deleted teammate for good.

Comparable public designs define a named agent as a name, a role prompt, a model and often a list of tools, kept as records or files, and let the person bring it into a chat; this design keeps the name, the role, the command line and the model, and leaves tools to the conversation's permissions.

## 7. Missing decisions

Resolve these before dependent implementation:

- **Models:** which models each command line offers, so the Teammates document can offer a choice instead of text, which the providers module's models-and-modes decision settles ([Missing decisions](../providers/README.md#7-missing-decisions)).
- **Instructions:** whether a command line's own option for added instructions replaces the role's place in the first prompt, where the command line offers one.
- **Retention:** whether and when deleted teammates are removed for good, and who asks for it.
