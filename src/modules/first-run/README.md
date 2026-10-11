# First run

**Scope:** The `first-run` module: the guide that takes a new person from installing TeamRun to a first conversation, under the [architecture's module rules](../../../docs/ARCHITECTURE.md#4-modules).

## 1. Purpose

A new person opens TeamRun with nothing set up: no agent command line found yet, no folder and no conversation.
The guide walks them through five short steps, ending with a conversation ready to send its first prompt.
Every step can be skipped, the guide resumes where the person left it, and Settings runs it again.

The guide sets nothing up itself: it shows what the providers module finds, leaves sign-in to each command line, and hands its choices to the conversations module.

## 2. Parts and dependencies

- **Runtime:** the guide's progress and its reads from the modules it depends on.
- **Window:** the guide's document and the module's setting ([Contributions](#4-contributions)).

The module depends on:

- `providers`, for the command lines and their status, through `providers.agents` ([Discovery and sign-in](../providers/README.md#discovery-and-sign-in));
- `teammates`, for the teammates, through `teammates.directory`;
- `conversations`, whose command `conversations.newThread` the guide runs with its choices.

No module depends on it.
From the shell, the runtime part needs its database, with its migrations, protocol methods and events; the window part needs commands and settings.

## 3. Published API

The module publishes no service.

## 4. Contributions

- **Document:** `first-run.guide`, the guide, one step at a time, with the steps' names and the current one shown along its top.
- **Command:** `first-run.open`, which opens the guide at its first step.
- **Settings:** on a Getting started page, an `Action` setting that runs `first-run.open`, labelled Run the guide again.
- **Methods and events:** the window part's reads of the guide's progress and of each step's data, its writes of progress, and the event `first-run.changed`.

## 5. Data

The database is `modules/first-run/first-run.sqlite`.
It keeps the guide's progress per device, since each device has its own command lines:

| Field | Holds |
|---|---|
| Device | The device the window's requests name |
| State | Not started, in progress, skipped or finished |
| Step | The step to resume at, while in progress |
| Choices | The choices made so far: no folder or a chosen one, the command line or teammate that helps, and the suggested task picked |

A chosen folder is kept only as the choice that one was made; its path goes to the conversations module, which owns folders, and never into this database.
The log records the steps reached, skipped and finished, never a path, a name or a task's text.

## 6. Behavior

### When the guide shows

The window part opens the guide when it activates and the device's state is not started or in progress, at the step to resume at.
It opens as any document a part opens while activating does, so it never takes the place of a saved layout's active tab (architecture, [Lifecycle](../../../docs/ARCHITECTURE.md#lifecycle)).

- **Skip:** Skip guide, on every step, ends the guide as skipped; it never opens by itself again.
  Skip this step goes on to the next step without its choice.
- **Resume:** closing the guide's tab keeps it in progress at its step, and it opens there at the next start.
  Every step can go back to the one before, keeping its choices.
- **Run again:** `first-run.open`, from Settings or command search, opens the guide at its first step with its earlier choices, in any state, and running it to its end finishes it again.
  Running it again changes nothing the guide's earlier runs handed over, such as a conversation.

### 1. Find the agent command lines

The guide lists each command line the providers module supports, with its status, and checks again when the person asks.

- **Found:** a command line whose status is `signedOut`, `signedIn` or `unknown` is found, and the guide goes on to sign-in.
- **None found:** when every command line is `notFound`, the guide says, in words, what to install: each supported command line by the name the providers module shows, with one sentence on how it is installed, and that TeamRun finds it on the PATH or at a program path set in Settings.
  It offers no download and no link to a provider's site ([Missing decisions](#7-missing-decisions)), and Check again runs discovery again.
- **Unsupported:** a command line whose version is outside its supported range, or whose approvals cannot be routed to TeamRun, shows its status's reason and cannot help.

### 2. Sign in

For each found command line, the guide shows whether the person is signed in, from the command line's own status interface.

- A command line that is `signedOut` shows its own sign-in command, as the Agents document does, with Copy, for the person to run in a terminal, and Check again.
- `unknown` shows the reason and Check again.
- The step goes on when at least one command line is `signedIn`, or when the person skips it.

TeamRun never signs in for the person, runs a sign-in command, or takes, reads or stores a credential.

### 3. Choose where to work

The person chooses a folder of their own, or no project, in which case the conversation works in a folder TeamRun creates for it ([Folders](../conversations/README.md#folders)).
No project is the default.
Until the window offers a folder chooser, the step offers no project alone and says that a folder can be chosen later ([Missing decisions](#7-missing-decisions)).

### 4. Pick who helps

The guide offers what the conversations module's composer offers: the teammates whose command line is `signedIn`, and a plain agent for each `signedIn` command line ([In a conversation](../teammates/README.md#in-a-conversation)).
The first `signedIn` command line's plain agent is the default.
Create a teammate opens the Teammates document; a teammate created there joins the list when the guide reads it again.
With no command line signed in, the step says why nobody can help yet and goes back to sign-in.

### 5. Start with a suggested task

The guide offers three suggested first tasks, in English, by where the person works:

- **With a folder:** tasks that only read, such as explaining how the project is organized, so a first prompt changes nothing in the person's files.
- **With no project:** tasks that make something small in the conversation's own folder, such as a short script.

The person picks one and can edit its text, or writes their own.
Start conversation runs `conversations.newThread` with the folder, the chosen agent and the task as the draft, then finishes the guide.
The conversation opens with the task in its composer; the person sends it, so the guide never sends a prompt or starts an agent itself.

### Screens and states

The design pass, from Oct 16, covers these screens and their states, in every theme and mode, at the smallest window and at 200% zoom:

- **The frame:** the steps along the top with the current one, Back, Next, Skip this step and Skip guide, and the guide opened again from Settings.
- **Find the agent command lines:** checking, some found, none found with the install words, an unsupported one with its reason, and a failed check.
- **Sign in:** signed in, signed out with its command and Copy, unknown with its reason, checking again, and none signed in yet.
- **Choose where to work:** no project chosen, a folder chosen, and no folder chooser yet.
- **Pick who helps:** plain agents only, teammates and plain agents, a teammate whose command line is not signed in, and nobody able to help.
- **Start with a suggested task:** the suggestions with and without a folder, one picked, its text edited, and the person's own task.
- **Resuming:** the guide opening at the step the person left.

## 7. Missing decisions

Resolve these before dependent implementation:

- **Install words and links:** what the guide says to install for each command line, and whether it may link to a provider's site or offer a download, wait for the Owner's decision on naming integrations; until then it gives words only.
- **Choosing a folder:** the window offers no folder chooser to a window part yet, as the [conversations module](../conversations/README.md#7-missing-decisions) also records.
- **Suggested tasks:** the exact suggestions' text, which the design pass writes.
