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
- **The app's host** (section 3): the one place in an app that serves every published tool to agents and raises their requests.
- **TeamRun's side** (section 4): which of its modules is the host, and the thin module that declares each tool.

## 2. The tool's interface

A tool's public interface has three parts.
Section 6 lists what each tool's parts provide in the first release.

### Window part

The tool's views and documents: where the person uses the tool and watches what agents do with it.
The app places them; the tool decides what they show.
Their look comes from the Design division's shared parts, never from a copy of them.

### Agent-facing tools

The tool publishes its actions for agents through the base's product-neutral tool registry, asked for in [desktop-core#21](https://github.com/noldova-com/desktop-core/issues/21), as part of the base's app-on-shell design, [desktop-core#6](https://github.com/noldova-com/desktop-core/issues/6).
It bundles no Model Context Protocol package and runs no server of its own: the app's host speaks the protocol for every tool ([section 3](#3-the-apps-host)).

The tool's runtime part publishes a descriptor and a handler for each action:

- **The descriptor:** the tool's name, a description for agents, the shapes of its input and its output, its risk level, and who raises its permission request ([Permission requests](#permission-requests)).
  The name is the tool's own and stays stable.
- **The handler:** runs the action with an input and a call context, and returns the result or a typed failure.
  The call context holds the calling agent session's id, its working folder, the scope the app names for the session, such as a conversation, and a signal that tells the handler the call has ended.
- **Results are data:** a result tells the agent what happened, and a tool's output never grants a permission ([Trust](ARCHITECTURE.md#trust)).
- **A fixed list:** the tool's interface lists the names of the tools it publishes, so an app can allow exactly those for a session.

The registry lists and calls a module's tools only while the module is switched on ([Turned off](#turned-off)).

### Permission requests

The tool lists the read-only actions that need no request.
Each other action's descriptor says who raises its request:

- **The host, by default:** for an input, the descriptor gives what the person decides on: the exact details, such as the command, the address, the app or the files, and the options the tool allows.
  The host raises the request before it calls the handler, and calls the handler only when the request is granted.
- **The tool itself:** for an action whose details are known only while it runs, such as an app that computer use reaches or a page the browser would leave its allow list for, the handler raises its own request at that point, naming the agent session from its call context.

Either way, the request goes through the base's permission contract, asked for in [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14), and carries:

- the requester, the tool's module id, also when the host raises it;
- the action;
- the exact details the person decides on;
- the action's risk level, from its descriptor;
- the options the tool allows;
- the agent session id, from the call context, when an agent's call raised it.

The outcomes are:

- **Granted:** the action runs.
- **Denied, expired or withdrawn:** the action does not run, and the call ends with a failure that says the action was refused, so the agent sees its call end with an error.
  A request nobody answers expires as denied.
- **Call ended:** whoever raised the request withdraws it when its call ends without an answer: the agent cancels the call, the session's connection closes, or the tool is switched off.

What the person does in a tool's own view, such as typing in the terminal, is the person's own action and raises no request.
A request that something other than an agent's call raises, such as a download a page starts in the embedded browser, is the tool's own and names no agent session.

The tool never decides whether to ask the person about an action outside its read-only list: its request is raised, and the app's policy decides.
The app never changes a tool's risk levels; its policy reads them.

## 3. The app's host

An app has one host that serves every published tool to its agents over the Model Context Protocol.
No tool module runs a server, and every request an agent's call raises outside a handler comes from the host.

- **What it serves:** each agent session gets the tools listed in the registry when the session starts.
  The list stays as it was at the start, since the agent's allow configuration names those tools; a tool switched off since is not callable, so its later calls end with a failure.
- **Binding a connection to a session:** each session reaches the host through a connection of its own, bound to it by a random secret of at least 256 bits made for that session alone, which the agent's command line sends as its bearer token.
  The host finds the session from the secret, compares secrets in constant time, refuses a request without a valid one, and revokes the secret when the session ends, which ends its calls and withdraws their pending requests.
  It takes the session's id from the connection, never from a tool's input or from anything the agent says, and passes it to the handler in the call context.
- **The secret is data:** it lives in the host's memory and in the command line's configuration for that session, never in a log, an event, a command line's arguments or its environment.
- **Transport:** the protocol's HTTP transport, on one listener for every session, bound to the loopback address only, on a port the system picks.
  The host refuses a request whose `Origin` header names a web origin, so a page in a browser cannot reach it.
- **A call:** the host checks the input against the descriptor's input shape, raises the request when the descriptor says the host raises it, and then calls the handler.
  It ends the call's signal when the agent cancels the call or the connection closes, and withdraws the request it raised for the call.

### The fallback

If a tool must ship before the base offers the registry, the tool serves its own tools from a small stdio server of its own, without a protocol package, which the agent's command line starts from the session's configuration the host writes.
It keeps the descriptors, the permission rules and the results above, so moving to the registry changes no tool name and no request.
This is a fallback, not the design, and the registry replaces it as soon as the base offers it.
How such a server learns its session and raises its requests is decided before any tool ships this way ([Missing decisions](#7-missing-decisions)).

## 4. How TeamRun takes in a tool

TeamRun takes a tool as a pinned package dependency.
The tool's package is a dependency like any other: it needs a present requirement, an exact pin and an explicit decision ([Automation and scripts](CODING-STANDARDS.md#11-automation-and-scripts)).

### The host: providers

TeamRun's host is the [providers module's tool host](../src/modules/providers/README.md#tool-host).

- **One module for the secret:** `providers` already writes each session's configuration into its own session folder, so a session's secret is made, written and checked in one module and reaches no other.
- **One place for requests:** it already raises the agents' own approval requests through the permission contract, so every request an agent raises outside a handler comes from one module, and [Conversations](../src/modules/conversations/README.md#permissions) answers them all with one card and one policy.
- **No new dependency:** it reads the registry from the shell, so it imports no tool module and depends on no other module.
- **The scope:** the session's owner names it; Conversations names the session's conversation.

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

- **Asked once:** for each session, `providers` allows the tools it serves on that session's connection in the command line's own allow configuration, so the person is asked once, by the tool's request ([providers' Permissions](../src/modules/providers/README.md#permissions)).
  It never turns on a command line's mode that skips every approval, so the agent's own built-in tools still ask.
- **Where a request shows:** a tool's request shows in its session's thread at the position it arrives, as its own entry.
  It is not nested in the agent's tool call: the host never sees the command line's id for that call, and matching a request to a call by its name or its order would be a race.
  A request that names no session shows nowhere yet, so it expires as denied and the action does not run ([Conversations' Permissions](../src/modules/conversations/README.md#permissions)).
- **Withdrawing:** Conversations never withdraws a tool's request itself; whoever raised it does, when the call ends.

### Turned off

A tool can be present in the build but switched off, by its module's setting.
While it is off, its module places none of its views and the registry neither lists nor calls its tools, so the host serves none of them, no session reaches it, it raises no request, and nothing of it shows.
Switching it off ends its running calls with a failure and withdraws their pending requests; sessions already running go on without its tools.
Switching it on lists its tools again, for the sessions that start from then on.

A tool in preview has such a setting, off by default, and a Preview label in its views and its setting.
Its version stays a plain number, never with a suffix.

## 5. Ownership

| Concern | Owner |
|---|---|
| The tool's actions, their names and descriptors, the details each request shows, each action's risk level, which read-only actions need no request, and who raises each request | The tool |
| The handlers, the requests a handler raises itself, and the window part's behavior | The tool |
| Publishing, listing and calling tools, and leaving out a switched-off module's tools | The base's tool registry |
| Routing requests, recording decisions, storing, listing and revoking remembered answers, and expiry | The base's permission contract |
| The permission card the person answers, the policy per conversation, and the scope each session names | TeamRun's Conversations module |
| The host: serving the registry's tools, binding each connection to one session, the requests it raises, writing each session's connection and allow configuration, and turning the agent's own approval requests into runtime requests | TeamRun's providers module |
| Declaring the tool, placing its window part, and the setting that switches it on and off | TeamRun's module for the tool |

## 6. The first release

Each tool provides what follows, for any app.
A surface the shell does not offer yet is asked for in the base's repository, and every tool publishes through the [tool registry](#agent-facing-tools) and raises its requests through the base's permission contract, [desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14).

### Terminal

- **Agents:** run a command, and read its output and its exit code.
- **Permission:** one request per command, which the host raises, with the command and its working folder as the details.
- **Shell surface:** a pseudo-terminal on every target, from the tool's own native addon, built and signed with the app, through the path for module addons asked for in [desktop-core#13](https://github.com/noldova-com/desktop-core/issues/13).

### Embedded browser

- **Isolation:** a separate profile for each workspace the app names, with no access to the app's own window, its bridge to the desktop, its protocol or its credentials.
- **Agents:** navigate, give input, take a screenshot and read the console.
- **Origins:** an allow list of origins; navigation outside it, downloads and new windows are refused unless the person approves them, through requests the tool raises itself.
- **Shell surface:** a guarded embedded-browser pane, asked for in [desktop-core#12](https://github.com/noldova-com/desktop-core/issues/12).
- **Preview:** it ships in preview, switched off until the person switches it on ([Turned off](#turned-off)).

### Computer use

- **Approval:** the person approves each app before agents can see or control it, through a request the tool raises itself when an agent first reaches that app.
- **Stop:** a stop control stays in view while agents control the computer, and ends that control at once.
- **Agents:** read the screen, and give mouse and keyboard input.
- **The system's prompts:** the operating system's privacy prompts are the person's to answer.
  The tool never answers, works around or changes them, or any other security setting.
- **Preview:** it ships in preview, switched off until the person switches it on ([Turned off](#turned-off)).

### Git

- **Agents:** read the status and the diff, stage and revert changes, and commit.
- **Worktrees:** a worktree for each scope the call context names, so two scopes never share a working tree; in TeamRun, each conversation.
- **Pull requests:** create a pull request and read its checks through the GitHub command line, using its own sign-in; the tool never reads its credentials.

The Git tool acts on the person's repository, with the person's approval.
In TeamRun, the [checkpoints module](../src/modules/checkpoints/README.md) never touches that repository, and the two share nothing.

## 7. Missing decisions

Resolve these before dependent implementation:

- **The base:** the surfaces this document names are the base's, and TeamRun still runs its own shell.
  Whether TeamRun takes them from the base's packages, and when, is not decided here, nor whether its build can then declare a tool's module straight from the package.
- **The registry's interface:** its descriptors, handlers, calls, failures and versioning, which [desktop-core#21](https://github.com/noldova-com/desktop-core/issues/21) defines; section 2 follows it once it is defined.
- **Risk levels:** the scale of risk levels comes with the base's permission contract.
- **Raising for a tool:** whether the permission contract lets the host raise a request that names the tool's module as its requester ([desktop-core#14](https://github.com/noldova-com/desktop-core/issues/14)).
- **The host's protocol:** whether the host implements the part of the protocol it needs or takes a protocol package ([providers' Missing decisions](../src/modules/providers/README.md#7-missing-decisions)).
- **The fallback's reach:** how a tool's own stdio server learns its session and raises its requests through the permission contract ([The fallback](#the-fallback)).
- **Requests without a session:** where a request that names no agent session shows, which Conversations decides ([Missing decisions](../src/modules/conversations/README.md#7-missing-decisions)).
