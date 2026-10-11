# Tool modules

**Scope:** The contract between a tool module and an app on the base: what a tool provides to any app, how TeamRun, its first user, takes one in, who owns what, and what each tool provides in the first release.
It builds on the [module contract](ARCHITECTURE.md#4-modules) and changes none of it.

## 1. What a tool module is

A tool lets a person, and the agents working for them, act on something outside the app: a terminal, an embedded browser, the screen and input of the computer, or a Git repository.
Each tool is its own product-neutral project, with its own repository, versions and releases, shipped as installed packages.
It works for any app built on the base, holds no app's names, text or behavior, and depends on no app.
An app configures it only through its public interface.

The contract has two sides:

- **The tool's interface** (section 2): its window part, its agent-facing tools and its permission requests, the same for every app.
- **The app's wrapper** (section 3): a thin module of the app's own that adapts that interface to the app.

## 2. The tool's interface

A tool's public interface has three parts.
Section 4 lists what each tool's parts provide in the first release.

### Window part

The tool's views and documents: where the person uses the tool and watches what agents do with it.
The app places them; the tool decides what they show.
Their look comes from the Design division's shared parts, never from a copy of them.

### Agent-facing tools

The tool serves its actions to agents as tools over the Model Context Protocol.

- **One connection per agent session.**
  `openSessionAsync(agentSessionId, workingFolder)` opens a connection for that session alone and returns its description as data: the server's name, how an agent's command line reaches it, and whatever identifies or authenticates the connection.
  `closeSessionAsync(agentSessionId)` closes it.
- **The calling session comes from the connection.**
  A tool takes the agent session id from the connection the call arrives on, never from a tool's arguments or from anything the agent says.
- **One action per tool.**
  Each agent-facing tool is one of the tool's actions, under a stable name the tool owns.
- **Results are data.**
  A tool's result tells the agent what happened, and a tool's output never grants a permission ([Trust](ARCHITECTURE.md#trust)).
- **A fixed list.**
  The tool's interface lists the names of the tools its server serves, so an app can allow exactly those for a session.

### Hosting

- **Where it runs:** the tool's server runs in the app's runtime, inside the runtime part of the app's module for the tool, never as a program an agent's command line starts.
  A program the tool needs besides, such as a helper with native access, is started through the runtime part's context and ends with the part ([Programs modules run](ARCHITECTURE.md#programs-modules-run)).
- **Transport:** the Model Context Protocol's HTTP transport, on one listener for the tool, bound to the loopback address only, on a port the system picks.
  The server refuses a request whose `Origin` header names a web origin, so a page in a browser cannot reach it.
- **Binding a connection to a session:** `openSessionAsync` makes a new random secret of at least 256 bits for that session alone.
  The description it returns carries the secret, as the bearer token the command line sends with every request.
  The server finds the session from the secret, compares secrets in constant time, and refuses a request without a valid one.
  `closeSessionAsync` revokes the secret at once, so the session's later requests are refused and its pending permission requests are withdrawn.
- **The secret is data:** it lives in the server's memory and in the description it returns, never in a log, an event, a command line's arguments or its environment.
- **Lifetime:** the listener starts with the first connection a session opens, not when the part activates, so activation stays light ([Lifecycle](ARCHITECTURE.md#lifecycle)).
  It stops, closing every connection, when the part deactivates or the tool is turned off.

### Permission requests

The tool lists the read-only actions that need no request.
Before it runs any other action, it raises a request through the base's permission contract, asked for in [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14).
The request carries:

- the requester, the module id the app gives the tool;
- the action;
- the exact details the person decides on, such as the command, the address, the app or the files;
- the action's risk level;
- the options the tool allows;
- the agent session id, taken from the connection, when an agent's call raised it.

The outcomes are:

- **Granted:** the action runs.
- **Denied, expired or withdrawn:** the action does not run, and the agent-facing tool returns an error result that says the action was refused, so the agent sees its call end with an error.
  A request nobody answers expires as denied.
- **Call ended:** the request belongs to the tool, which withdraws it when its call ends without an answer: the agent cancels the call, or the session's connection closes.

What the person does in a tool's own view, such as typing in the terminal, is the person's own action and raises no request.
A request that something other than an agent's call raises, such as a download a page starts in the embedded browser, names no agent session.

The tool never decides whether to ask the person about an action outside its read-only list: it raises the request, and the app's policy decides.
The app never changes a tool's risk levels; its policy reads them.

## 3. How TeamRun takes in a tool

TeamRun takes a tool as a pinned package dependency and wraps it in a thin module of its own, `src/modules/<id>`.
The tool's package is a dependency like any other: it needs a present requirement, an exact pin and an explicit decision ([Automation and scripts](CODING-STANDARDS.md#11-automation-and-scripts)).

### The wrapper

The wrapper:

- declares the tool, with `module.json` and a line in the build's module list, as every module does ([Components](ARCHITECTURE.md#2-components-and-dependency-direction));
- places the tool's window part as its module's views and documents, under its own id ([Vocabulary and identity](ARCHITECTURE.md#3-vocabulary-and-identity));
- hosts the tool's server in its runtime part ([Hosting](#hosting));
- registers the tool with Conversations as a source of agent-facing tools ([Connections](#connections));
- gives the tool its module id as the requester of its permission requests.

The wrapper never patches or copies the tool's code.
It configures the tool only through the tool's public interface, and asks for a change the tool needs through an issue in the tool's repository.
The tool never depends on the wrapper, on Conversations or on anything else of TeamRun's.

### Connections

Conversations starts every agent session, and it imports no tool module ([Conversations](../src/modules/conversations/README.md#2-parts-and-dependencies)).
It publishes one contract, `conversations.tools`, which each wrapper implements and registers, as the architecture's [Cooperation](ARCHITECTURE.md#cooperation) rule describes.
The wrapper declares `conversations` as a dependency, so the dependencies run from the wrapper to Conversations to `providers`, without a cycle.

The wrapper's runtime part hosts the tool's server ([Hosting](#hosting)) and registers one source for it:

- **What a source declares:** the wrapper's module id, the server's name, the names of the tools it serves, from the tool's fixed list, and the tool's two calls, `openSessionAsync(agentSessionId, workingFolder)` and `closeSessionAsync(agentSessionId)`, which the wrapper passes through to the tool.
- **When:** the runtime part registers the source when it activates with the tool turned on, and when the tool is turned on later.
  It withdraws the source when the tool is turned off and when the part deactivates ([Turned off](#turned-off)).
- **One per module:** Conversations refuses a second source from the same module id, so a session never holds two connections to one tool.

What Conversations does with the sources:

- When Conversations starts a session, it opens a connection from every source registered at that moment and passes the descriptions to `providers` in memory.
  A session's tools stay as they were when it started, apart from a source that is withdrawn.
- `providers` writes them into its own session folder, in the command line's configuration for that session only, and removes them with the folder ([providers' Sessions](../src/modules/providers/README.md#sessions)).
- Conversations closes the session's connections when the session ends.
- A source that fails to open leaves its tools out of that session and is reported under its module's id; it never stops the session from starting.

No module writes another's files, and what authenticates a connection never goes into arguments, the environment, a log or an event.

### Permissions in TeamRun

- **Asked once:** for each session, `providers` allows the tools served on that session's connections in the command line's own allow configuration, so the person is asked once, by the tool's request ([providers' Permissions](../src/modules/providers/README.md#permissions)).
  It never turns on a command line's mode that skips every approval, so the agent's own built-in tools still ask.
- **Where a request shows:** a tool's request shows in its session's thread at the position it arrives, as its own entry.
  It is not nested in the agent's tool call: the tool never sees the command line's id for that call, and matching a request to a call by its name or its order would be a race.
  A request that names no session shows nowhere yet, so it expires as denied and the action does not run ([Conversations' Permissions](../src/modules/conversations/README.md#permissions)).
- **Withdrawing:** Conversations never withdraws a tool's request itself; the tool does, when the call ends.

### Turned off

A tool can be present in the build but turned off, by a setting its wrapper contributes.
While it is off, the wrapper places none of its views, registers no source with `conversations.tools`, and its server does not listen, so no session reaches it, it raises no request, and nothing of it shows.
Turning it off withdraws the source and stops the server, which closes its open connections, withdraws their pending requests and ends their calls with an error result; sessions already running go on without its tools.
Turning it on registers the source again, so the sessions that start from then on reach it.

A tool in preview has such a setting, off by default, and a Preview label in its views and its setting.
Its version stays a plain number, never with a suffix.

## 4. Ownership

| Concern | Owner |
|---|---|
| The tool's actions, their names, the details each request shows, each action's risk level, and which read-only actions need no request | The tool |
| The agent-facing tools, their server and its listener, binding each connection to one session, and the window part's behavior | The tool |
| Routing requests, recording decisions, storing, listing and revoking remembered answers, and expiry | The base's permission contract |
| The permission card the person answers, and the policy per conversation: which requests reach the person and which remembered answers apply | TeamRun's Conversations module |
| The `conversations.tools` contract, and opening and closing each session's connections through it | TeamRun's Conversations module |
| Writing a session's connections into the command line's configuration, its allow configuration, and turning the agent's own approval requests into runtime requests | TeamRun's providers module |
| Declaring the tool, hosting its server in the runtime part, placing its window part, registering it with `conversations.tools`, naming its requester, and the setting that turns it on and off | TeamRun's wrapper |

## 5. The first release

Each tool provides what follows, for any app.
A surface the shell does not offer yet is asked for in the base's repository, and every tool raises its requests through the base's permission contract, [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14).

### Terminal

- **Agents:** run a command, and read its output and its exit code.
- **Permission:** one request per command, with the command and its working folder as the details.
- **Shell surface:** a pseudo-terminal on every target, from the tool's own native addon, built and signed with the app, through the path for module addons asked for in [desktop-core#13](https://github.com/noldova-com/desktop-core/issues/13).

### Embedded browser

- **Isolation:** a separate profile for each workspace the app names, with no access to the app's own window, its bridge to the desktop, its protocol or its credentials.
- **Agents:** navigate, give input, take a screenshot and read the console.
- **Origins:** an allow list of origins; navigation outside it, downloads and new windows are refused unless the person approves them.
- **Shell surface:** a guarded embedded-browser pane, asked for in [desktop-core#12](https://github.com/noldova-com/desktop-core/issues/12).
- **Preview:** it ships in preview, turned off until the person turns it on ([Turned off](#turned-off)).

### Computer use

- **Approval:** the person approves each app before agents can see or control it.
- **Stop:** a stop control stays in view while agents control the computer, and ends that control at once.
- **Agents:** read the screen, and give mouse and keyboard input.
- **The system's prompts:** the operating system's privacy prompts are the person's to answer.
  The tool never answers, works around or changes them, or any other security setting.
- **Preview:** it ships in preview, turned off until the person turns it on ([Turned off](#turned-off)).

### Git

- **Agents:** read the status and the diff, stage and revert changes, and commit.
- **Worktrees:** a worktree for each scope the app names, so two scopes never share a working tree; TeamRun names one for each conversation.
- **Pull requests:** create a pull request and read its checks through the GitHub command line, using its own sign-in; the tool never reads its credentials.

The Git tool acts on the person's repository, with the person's approval.
In TeamRun, the [checkpoints module](../src/modules/checkpoints/README.md) never touches that repository, and the two share nothing.

## 6. Missing decisions

Resolve these before dependent implementation:

- **The base:** the surfaces this document names are the base's, and TeamRun still runs its own shell.
  Whether TeamRun takes them from the base's packages, and when, is not decided here.
- **Risk levels:** the scale of risk levels comes with the base's permission contract.
- **Requests without a session:** where a request that names no agent session shows, which Conversations decides ([Missing decisions](../src/modules/conversations/README.md#7-missing-decisions)).
