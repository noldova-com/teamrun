# Tool modules

**Scope:** The contract between a tool module and an app on the base: what a tool provides to any app, how the app's one host serves it to agents, how TeamRun, its first user, takes one in, who owns what, and what each tool provides in the first release.
It builds on the [module contract](ARCHITECTURE.md#4-modules) and changes none of it.

## 1. What a tool module is

A tool lets a person, and the agents working for them, act on something outside the app: a terminal, an embedded browser, the screen and input of the computer, or a Git repository.
Each tool is its own product-neutral project, with its own repository, versions and releases, shipped as installed packages.
It works for any app built on the base, holds no app's names, text or behavior, and depends on no app.
An app configures it only through its public interface.

The contract has three sides:

- **The tool's interface** (section 2): its window part, the tools it publishes for agents and its permission requests, the same for every app.
- **The app's host** (section 3): the one place in an app that serves every published tool to agents.
- **TeamRun's side** (section 4): which of its modules is the host, and the thin module that declares each tool.

## 2. The tool's interface

A tool's public interface has three parts.
Section 6 lists what each tool's parts provide in the first release.

### Window part

The tool's views and documents: where the person uses the tool and watches what agents do with it.
The app places them; the tool decides what they show.
Their look comes from the Design division's shared parts, never from a copy of them.

The person's own input in a view, such as keys typed into the terminal or a resize, reaches the tool's runtime part only through methods its window part alone may call, never through the host or from an agent, which the base provides ([desktop-core#6](https://github.com/noldova-com/desktop-core/issues/6)).
Agents reach a tool only through the tools it publishes.

### Agent-facing tools

The tool publishes its actions for agents through the base's product-neutral tool registry, asked for in [desktop-core#21](https://github.com/noldova-com/desktop-core/issues/21), as part of the base's app-on-shell design, [desktop-core#6](https://github.com/noldova-com/desktop-core/issues/6).
It bundles no Model Context Protocol package and runs no server of its own: the app's host speaks the protocol for every tool ([section 3](#3-the-apps-host)).

The tool's runtime part publishes a descriptor and a handler for each action:

- **The descriptor:** the tool's name, a description for agents, its input's and its output's shapes as JSON Schema, its output's size limits, its deadlines, its default and maximum risk levels, and who raises its permission request ([Permission requests](#permission-requests)).
  The name is the tool's own and stays stable.
- **The handler:** runs the action with an input and a call context, and returns a result or a failure.
- **The call context:** the calling agent session's id, its working folder, the scope the app names for the session, such as a conversation, the resources the app bound to the session, such as a worktree, the terminals it may use or a browser profile, and a signal that tells the handler the call has ended.
  The app sets the scope and the bound resources, never the agent or a tool's input, and a tool acts only within them.
- **A fixed list:** the tool's interface lists the names of the tools it publishes, so an app can allow exactly those for a session.

The registry lists and calls a module's tools only while the module is switched on ([Turned off](#turned-off)).
It tells a tool when an agent session ends, so the tool ends what it holds for that session, such as the terminals the session opened.

### Results and failures

- **A result** is text for the agent and structured fields that follow the descriptor's output shape, such as an exit code, whether a command still runs, or the working folder.
- **Untrusted content:** a result that carries content someone else may have written, such as a page, a program's output or a repository's files, marks it as untrusted, with where it came from, and the host keeps that mark in what the agent sees.
  A tool's output never grants a permission ([Trust](ARCHITECTURE.md#trust)).
- **Limits:** a result over the descriptor's size limits is cut and says so.
  An action still running at its deadline returns what it has so far, and a later call goes on from there, so no result streams.
- **A failure** has a code from one shared set, or the tool's own code with a module code beside it, and a message for people, so an agent can tell why a call failed and whether to retry:

| Shared code | Means |
|---|---|
| `Refused` | The input was invalid, such as a path outside the bound resources. |
| `Denied` | The person, or the app's policy, denied the permission request. |
| `Expired` | Nobody answered the permission request in time. |
| `Withdrawn` | The call ended before its request was answered. |
| `Stale` | What the request showed changed after the grant, so nothing ran. |
| `TimedOut` | The call's deadline passed. |
| `TooLarge` | The result cannot fit its limit, even cut. |
| `Unavailable` | The tool cannot serve the call now, such as when it is switched off. |

The shared codes take the base's names once its permission contract and registry define them.

### Permission requests

Every call an agent makes raises one permission request through the base's permission contract, asked for in [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14), before its action runs, read-only actions included.
So the app's policy sees every call, and a tool never lets a call skip it.

- **Who raises it:** the descriptor names the host or the tool, for any action.
  The host raises it before it calls the handler, with the details the descriptor gives for the input.
  The tool raises it when the details depend on state only the tool sees when the call runs, such as a terminal's shell and working folder, a repository's HEAD and what a discard would lose, or the origin a page would go to.
- **What a grant binds:** the action runs exactly as its request showed it.
  The tool checks that state again just before it acts, and when it changed, nothing runs and the call fails as `Stale`.
- **Risk per call:** the request carries the call's risk level, which the tool sets between its descriptor's default and maximum, such as a higher risk for reading a terminal the person shared than one the agent opened.
- **Whether it asks:** the tool sets, for each call, whether the person must be asked and which options the request offers, including whether an answer may be remembered and for what.
  The app's policy may add an ask and narrow the options, but never skips an ask the tool requires or widens its options, and a remembered answer applies only where the tool offered remembering.
  A call the tool lets go without an ask still raises its request, so the policy may ask for it.

The request carries:

- the requester, the tool's module, also when the host raises the request ([Raising for a tool](#7-missing-decisions));
- the action;
- the exact details the person decides on, such as the command, the address, the app or the files, and the state the grant binds;
- the call's risk level, whether it asks, and the options;
- the agent session id, from the call context, when an agent's call raised it.

The outcomes are:

- **Granted:** the action runs.
- **Denied, expired or withdrawn:** the action does not run, and the call fails as `Denied`, `Expired` or `Withdrawn`.
  A request nobody answers expires.
- **Call ended:** whoever raised the request withdraws it when its call ends without an answer: the agent cancels the call, the session's connection closes, or the tool is switched off.

What the person does in a tool's own view is the person's own action and raises no request, unless the tool asks for it, such as before a pane action loses data.
A request that something other than an agent's call raises, such as a navigation a page starts in the embedded browser, is the tool's own and names no agent session.
The app never changes a tool's risk levels; its policy reads them.

## 3. The app's host

An app has one host that serves every published tool to its agents over the Model Context Protocol.
No tool module runs a server.

- **What it serves:** each agent session gets the tools listed in the registry when the session starts.
  The list stays as it was at the start, since the agent's allow configuration names those tools; a tool switched off since is not callable, so its later calls fail as `Unavailable`.
- **Binding a connection to a session:** each session reaches the host through a connection of its own, which names the session by an id that is not secret, in its path, and carries a random secret of at least 256 bits made for that session alone, as the bearer token the agent's command line sends.
  The host finds the session by that id and compares the session's secret with the token in constant time, so the lookup never compares secrets.
  It refuses a request without a valid token, and revokes the secret when the session ends, which ends the session's calls and withdraws their pending requests.
  It takes the session from the connection, never from a tool's input or from anything the agent says, and passes it to the handler in the call context.
- **The secret is data:** it lives in the host's memory and in the command line's configuration for that session, never in a log, an event, a command line's arguments or its environment.
- **Transport:** the protocol's HTTP transport, on one listener for every session, bound to the loopback address only, on a port the system picks.
  The host refuses any request that carries an `Origin` header, `null` included, since the command lines send none and a page in a browser always does.
  It checks the origin and the token before it reads a request's body, and bounds the body's size ([Secure coding](CODING-STANDARDS.md#8-secure-coding)).
- **A call:** the host checks the input against the descriptor's input shape, raises the request when the descriptor names the host, and then calls the handler.
  It ends the call's signal when the agent cancels the call or the connection closes, and withdraws the request it raised for the call.
  It passes the result's untrusted marks on, and gives the agent the input and output shapes unchanged.
- **A session's start and end:** the app sets up the resources it binds to a session, such as a worktree, before the session starts, and the host tells the registry when the session ends.

### The fallback

If a tool must ship before the base offers the registry, the tool serves its own tools from a small stdio server of its own, without a protocol package, which the agent's command line starts from the session's configuration the host writes.
It keeps the descriptors, the permission rules and the results above, so moving to the registry changes no tool name and no request.
This is a fallback, not the design, and the registry replaces it as soon as the base offers it.
How such a server learns its session and raises its requests, and who owns and ends its process, which the command line starts outside the runtime, is decided before any tool ships this way ([Missing decisions](#7-missing-decisions)).

## 4. How TeamRun takes in a tool

TeamRun takes a tool as a pinned package dependency.
The tool's package is a dependency like any other: it needs a present requirement, an exact pin and an explicit decision ([Automation and scripts](CODING-STANDARDS.md#11-automation-and-scripts)).

### The host: providers

TeamRun's host is the [providers module's tool host](../src/modules/providers/README.md#tool-host).

- **One module for the secret:** `providers` already writes each session's configuration into its own session folder, so a session's secret is made, written and checked in one module and reaches no other.
- **One place for the agents' requests:** it already raises the agents' own approval requests through the permission contract, so the requests the host raises come from the same module, and [Conversations](../src/modules/conversations/README.md#permissions) answers every request with one card and one policy.
- **No new dependency:** it reads the registry from the shell, so it imports no tool module and depends on no other module.
- **The scope and bound resources:** the session's owner names them; Conversations names the session's conversation, and binds the conversation's resources, such as its worktree.

The cost is that `providers` grows.
The host is a section of its own in the module, with its own interface to the adapters, so it can move to a module of its own without changing a tool or an adapter.

### The module for a tool

TeamRun's build declares modules only from `src/modules`, so each tool keeps a thin module there, `src/modules/<id>`, which holds only a declaration:

- `module.json` and a line in the build's module list, as every module has ([Components](ARCHITECTURE.md#2-components-and-dependency-direction));
- the setting that switches the tool on and off ([Turned off](#turned-off));
- runtime and window parts that give the tool's package their context and place its window part as the module's views and documents, under the module's id ([Vocabulary and identity](ARCHITECTURE.md#3-vocabulary-and-identity)).

The module hosts no server, registers nothing with another module and depends on none: the tool publishes its own tools from that runtime part, under that module's id.
It goes away once the build can declare a module straight from an installed package, which is part of the base decision ([Missing decisions](#7-missing-decisions)).

The module never patches or copies the tool's code.
It configures the tool only through the tool's public interface, and asks for a change the tool needs through an issue in the tool's repository.
The tool never depends on that module or on anything else of TeamRun's.

### Permissions in TeamRun

- **Asked once:** for each session, `providers` allows the tools it serves on that session's connection in the command line's own allow configuration, so the person is asked only by the tool's request ([providers' Permissions](../src/modules/providers/README.md#permissions)).
  It never turns on a command line's mode that skips every approval, so the agent's own built-in tools still ask.
- **The policy:** Conversations' policy asks by default, and keeps every ask a tool requires.
  The first low-risk request in a conversation that its tool lets go without an ask offers Always allow, with the scope "this tool's low-risk actions in this conversation".
  One approval then covers them, such as the browser's clicks, keys and navigation within its allow list, and the grant is listed and revocable, as the permission contract keeps remembered answers ([desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14)).
- **Never low risk:** in the browser, a click or key that submits a form, starts a download or moves to another origin is never low risk, whatever the tool's descriptor says.
  No low-risk grant covers it, and it always asks.
- **Where a request shows:** a tool's request shows in its session's thread at the position it arrives, as its own entry.
  It is not nested in the agent's tool call: the host never sees the command line's id for that call, and matching a request to a call by its name or its order would be a race.
  A request that names no session shows nowhere yet, so it expires and the action does not run ([Conversations' Permissions](../src/modules/conversations/README.md#permissions)).
- **Withdrawing:** Conversations never withdraws a tool's request itself; whoever raised it does, when the call ends.

### Turned off

A tool can be present in the build but switched off, by its module's setting.
While it is off, its module places none of its views and the registry neither lists nor calls its tools, so the host serves none of them, no session reaches it, it raises no request, and nothing of it shows.
Switching it off ends its running calls as `Unavailable` and withdraws their pending requests; sessions already running go on without its tools.
Switching it on lists its tools again, for the sessions that start from then on.

A tool in preview has such a setting, off by default, and a Preview label in its views and its setting.
Its version stays a plain number, never with a suffix.

## 5. Ownership

| Concern | Owner |
|---|---|
| The tool's actions, their names and descriptors, the details each request shows and the state a grant binds, each call's risk level, whether it asks and the options it offers, and who raises each request | The tool |
| The handlers, the requests a tool raises itself, its results and failures, and the window part's behavior | The tool |
| Publishing, listing and calling tools, session-end events, and leaving out a switched-off module's tools | The base's tool registry |
| Routing requests, recording decisions, storing, listing and revoking remembered answers, and expiry | The base's permission contract |
| The permission card the person answers, the policy per conversation within each tool's limits, and the scope and resources each session is bound to | TeamRun's Conversations module |
| The host: serving the registry's tools, binding each connection to one session, the requests it raises, writing each session's connection and allow configuration, and turning the agent's own approval requests into runtime requests | TeamRun's providers module |
| Declaring the tool, placing its window part, and the setting that switches it on and off | TeamRun's module for the tool |

## 6. The first release

Each tool provides what follows, for any app.
A surface the shell does not offer yet is asked for in the base's repository, and every tool publishes through the [tool registry](#agent-facing-tools) and raises its requests through the base's permission contract, [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14).

### Terminal

- **Agents:** `terminal_list`, `terminal_read`, `terminal_open`, `terminal_run`, `terminal_write`, `terminal_interrupt` and `terminal_close`, only in the terminals the session opened or the person shared.
- **Permission:** one request per command, which the tool raises, with the command, the terminal, its shell and its working folder as the details.
  The tool checks just before writing that the terminal still waits at an empty prompt, and writes only on a grant and only the bytes the request showed, with control characters shown escaped; a terminal that changed fails the call as `Stale`.
  The working folder it shows comes only from the terminal's own verified integration marks, never from text a program printed.
- **Results:** a command's output as untrusted text, with its exit code, whether it still runs, whether it was cut, and the working folder; a command still running at its deadline returns its output so far, and `terminal_read` goes on from there.
- **Shell surface:** a pseudo-terminal on every target, from the tool's own native addon, built and signed with the app, through the path for module addons asked for in [desktop-core#13](https://github.com/noldova-com/desktop-core/issues/13).

### Embedded browser

- **Isolation:** a separate profile for each workspace the app names, picked by the profile the app binds to the session, with no access to the app's own window, its bridge to the desktop, its protocol or its credentials.
- **Agents:** navigate, take a snapshot of the page's accessibility tree with element references, give input, take a screenshot and read the console.
- **Asking:** navigating within an allow list of origins, a click, a key press or typing into an ordinary field needs no ask.
  A click or key that would submit a form, start a download or move to another origin is the exception: the tool marks it in the request's details and asks for it every time, at medium risk or higher, and no low-risk grant covers it.
  Navigating off the list asks at medium risk, with a flag in its details when the origin was never allowed in that workspace.
  Typing into a password, one-time-code or card field asks at high risk on every call.
- **Refused:** downloads and new windows are refused in the first release, with no request.
- **Results:** page text, snapshots and console output are untrusted, with their origin; images up to 1 MB as PNG or JPEG, and text up to 256 KB per call.
- **Shell surface:** a guarded embedded-browser pane, asked for in [desktop-core#12](https://github.com/noldova-com/desktop-core/issues/12).
- **Preview:** it ships in preview, switched off until the person switches it on ([Turned off](#turned-off)).

### Computer use

- **Approval:** the person approves each app before agents can see or control it, through a request the tool raises when an agent first reaches that app.
- **Stop:** a stop control stays in view while agents control the computer, and ends that control at once.
- **Agents:** read the screen, and give mouse and keyboard input.
- **The system's prompts:** the operating system's privacy prompts are the person's to answer.
  The tool never answers, works around or changes them, or any other security setting.
- **Preview:** it ships in preview, switched off until the person switches it on ([Turned off](#turned-off)).

### Git

- **Agents:** read the status, the diff and the log; stage, unstage and discard changes, with an undo for discards; commit; push the scope's own branch, never forced; create a pull request and read its checks.
- **Permission:** the tool raises all its own requests, bound to HEAD and the objects each action affects.
  Discarding and removing a worktree lose what Git cannot give back, so they ask every time and are never remembered.
- **Worktrees:** the app creates the scope's worktree through the tool's interface before the session starts, and starts the session in it; the app removes it when the scope is deleted, and a session's end never removes it.
  In TeamRun the scope is the conversation.
- **Pull requests:** through the GitHub command line, using its own sign-in; the tool never reads its credentials.

The Git tool's own contract is asked for in [git#5](https://github.com/noldova-com/git/issues/5).
It acts on the person's repository, with the person's approval.
In TeamRun, the [checkpoints module](../src/modules/checkpoints/README.md) never touches that repository, and the two share nothing.

## 7. Missing decisions

Resolve these before dependent implementation:

- **The base:** the surfaces this document names are the base's, and TeamRun still runs its own shell.
  Whether TeamRun takes them from the base's packages, and when, is not decided here, nor whether its build can then declare a tool's module straight from the package.
- **The registry's interface:** its descriptors, handlers, calls, failures, events and versioning, which [desktop-core#21](https://github.com/noldova-com/desktop-core/issues/21) defines; section 2 follows it once it is defined.
- **Risk levels:** the scale of risk levels comes with the base's permission contract, and each tool's levels map onto it.
- **Raising for a tool:** how the host raises a request that names the tool's module as its requester, set by the base from the registry's record of the module that published the tool so the host cannot name another module, pending [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14) and [desktop-core#6](https://github.com/noldova-com/desktop-core/issues/6); neither provides it yet ([the question on desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14#issuecomment-6105275886)).
- **The host's protocol:** whether the host implements the part of the protocol it needs or takes a protocol package ([providers' Missing decisions](../src/modules/providers/README.md#7-missing-decisions)).
- **The fallback:** whether there is one, and if so how a tool's stdio server learns its session and raises its requests, and who owns and ends its process ([The fallback](#the-fallback)).
- **Requests without a session:** where a request that names no agent session shows, which Conversations decides ([Missing decisions](../src/modules/conversations/README.md#7-missing-decisions)).
