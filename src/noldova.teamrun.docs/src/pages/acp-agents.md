# ACP agents

Besides the providers TeamRun knows by name, you can add any agent that speaks the Agent Client Protocol (ACP): one from the public ACP Registry, or an ACP command of your own on your computer.
Once added, the agent is a provider like the others: you sign it in, and teammates can answer through it.

## Finding an agent

In the **Providers** tab, choose **Add provider**; the last entry of its **Provider type** list is **ACP agents…**.
It opens a search list of the registry's agents for your computer, each with its icon, name, version, description, **About** and **Add**.
Under them are the local commands you added, and the form that adds one.

TeamRun keeps a copy of the registry's list and fetches it again at most once an hour, so the list shows offline too, and says so when it is old.
The list leaves out the providers TeamRun runs itself, such as Claude Code or Codex.
An agent that runs through `uvx` shows with the reason it can't be added, and no **Add**, for now.

An agent you add becomes the chosen provider type in Add provider once the list closes.

## Adding an agent from the registry

**Add** installs the agent's latest version:

- An agent that comes as a download is fetched over HTTPS and checked against the checksum the registry lists. When the registry lists none, the agent installs only from an HTTPS address and its row shows **Not checked**.
- An agent that runs through `npx` installs through your own `npm`, at the exact version the registry names.

A kind of agent that can't install on this computer says why; when it lacks a program, such as unzip, tar or npm, it names that program so you can install it first.
**Update** installs the registry's newer version, as for the other providers; the version it replaces stays until the next install, for a chat that may still run on it.

## Adding your own local command

The form under the list adds an ACP command you run on your computer, with its name, the command, its arguments and any variables it needs.

The values you type for its variables, such as a key the command needs, are kept in your system's secret store and given only to that command.
If a saved value is gone or can't be read, the agent doesn't start, and says why.

## Signing in

An agent signs in the way it names:

- **Its own sign-in:** TeamRun asks the agent to sign in.
- **A terminal sign-in:** **Sign in** runs the agent's sign-in command in a terminal. A local command signs in with its own command alone, without its saved values.
- **No sign-in:** an agent that names no sign-in needs none, and shows signed in once its session opens.

Each agent runs in your home folder with the one sign-in it keeps there, so TeamRun takes one provider of each agent.
Its **Sign out** also signs out your own copy of the agent, as its confirmation says.

## Removing an agent

You can't remove an agent while a provider still uses it, or while it is installing.
Removing an agent removes its files and, for a local command, its saved values.

## What an ACP agent can do

An added agent can do what its own ACP connection offers.
Settings' page **What each provider can do** shows the answers for each agent you added; the full table is on [What each provider can do](provider-features.md).

It can:

- run and stop a turn, resume a chat, and take images and files in a message;
- offer the models, efforts and modes the agent lists, including a mode that asks for nothing;
- ask your approval through permission cards, and ask you questions;
- show a plan checklist, generated images, and the tokens and cost of a reply where the agent reports them;
- use TeamRun's tools, and run TeamRun's approved tools without asking;
- follow and stop a background command it runs in TeamRun's terminal;
- run the `/` commands it lists, and sign in and out from TeamRun.

It can't:

- choose a speed or a context size, show plan-limit meters, show rows for its own sub-agents, or show the signed-in account: the agent connection names none of them;
- rewind within its session: the agent connection can only copy a whole session;
- offer a plan mode or a read-only mode: the agent connection gives no mode a meaning TeamRun can rely on;
- take a message into a running turn;
- have the model write the chat's title;
- sign in to several accounts;
- list its own MCP servers: the agent connection has no way to ask for them.

Not built yet: shared MCP servers, switching on the agent's own MCP servers, and TeamRun's explorer sub-agent.

**Compact the context** and `/compact` work only for an agent that lists `/compact` and then reports that it compacted.
Otherwise the reply ends with a note that the agent answered `/compact` without reporting it, so its context may not be compacted.
