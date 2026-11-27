# Troubleshooting

This page says where TeamRun shows a problem, and what each provider's common errors mean and how to fix them.

## Where errors show

A problem shows where you acted, when that place is still on screen:

- in a dialog, as its own message;
- on the Teammates, Providers and MCP servers pages, as a banner with **Dismiss**;
- in the composer, for an attachment;
- in a reply, in the chat;
- in Background tasks.

Every other problem shows as a notification:

| Notification | What it means | What it offers |
|---|---|---|
| A message wasn't sent | TeamRun refused a message, and says why. | **Open chat**, and when a provider is the reason, **Enable provider** while it is disabled and **Manage providers**. |
| A reply failed | A reply failed while its chat wasn't on screen. It is titled by the teammate and shows the reply's last error. | **Open chat**. |
| Something didn't load | A part of the window failed to load, such as the providers, the list of projects, chats and teammates, or a chat. | **Try again**, and **Open chat** for a chat. |
| "Couldn't …" | Another action failed, such as "Couldn't rename the chat" or "Couldn't sign in to Work", with the reason. | **Open chat** when it acted on a chat. It stays until you dismiss it. |

A notification goes by itself once the problem is over: for example, once you send in that chat, open the chat, or the load works.

When a window crashes, TeamRun offers to reload it or to open its log folder.
Nothing is sent anywhere; see [Privacy and network](privacy.md).

## Problems with any provider

**The provider isn't signed in, or its sign-in expired.**
Sign in again from the provider's row in **Manage providers**.
See [Providers](providers.md).

**The model isn't offered.**
When GitHub Copilot, Grok, OpenCode, Cursor or Antigravity doesn't offer the chosen model, the reply says so.
Choose **Choose a model** in the reply, or open the teammate or the composer's model menu, choose **Refresh models**, and pick a model.
Claude Code and Codex say this in their own words.

**"Not in catalog".**
The Teammates table marks a teammate's model that the provider no longer lists.
Choose a model the provider lists.

**The context is full.**
The reply names the provider and asks you to compact and retry.
Send `/compact` alone, or with a mention such as `@Codex /compact` to compact only that teammate, then send your message again.
Cursor and Antigravity can't compact their context, and the reply says so.

**The usage limit is reached.**
The reply stops with "Stopped: … reached its usage limit" and when it resets, if the provider says.
To keep work going on another account or provider, see [When usage runs out](sustain.md).

**A teammate stopped messaging other chats.**
A chain of teammates messaging each other stops at **Teammate hand-offs** in [Settings](settings.md#replies).

## Claude Code and Codex

**Codex on Windows: "setup refresh had errors".**
Codex CLI before 0.163.0 can fail every command while the Codex app is open.
TeamRun stops the turn and says what to do: close the Codex app, and update Codex CLI if it is older than 0.163.0.

**Codex: "the CLI package version does not match its executable".**
An update made while Codex was in use left Codex CLI half installed on Windows.
Quit TeamRun and every other app using Codex, reinstall Codex CLI, then try again.

**Codex was updated.**
TeamRun notices the update by itself before the next turn and starts the new version.
If you run Codex through a launcher such as Volta, pnpm or bun, TeamRun may not notice; restart TeamRun.

## GitHub Copilot

You need a GitHub Copilot subscription.

**"isn't signed in".**
Sign in from the provider's row: it opens a terminal that runs `copilot login`.
Then refresh the provider.

**Only Auto is offered.**
On Copilot Free the plan includes only Auto, and the model menu says so.
A model you chose that the plan doesn't include runs as Auto, and the reply's header says so, such as "Auto, kimi-k3 not available".

**The model list is empty, or a new plan doesn't show.**
Copilot answers with the plan of its sign-in, so **Refresh models** alone lists the old plan's models.
Run `copilot login` again in a terminal, then choose **Refresh models**.

**The models couldn't be refreshed.**
Copilot didn't list its models.
Choose **Refresh models** to try again.

**A different model than Auto answers.**
If you set a default model in Copilot's own settings, Copilot uses it instead of Auto, and doesn't tell TeamRun which.

**The `minimal` effort fails.**
It needs Copilot CLI 1.0.69 or later.

**A chat starts a new session.**
When Copilot can't load a chat's session, TeamRun starts a new one with the chat's history.

## Grok

**The model list is empty, or only shows `grok-4.6` and `grok-4.5`.**
Grok hadn't loaded its catalog yet.
Try again; a turn on another model fails saying the same.

## Antigravity

**Antigravity's models aren't listed.**
Antigravity names its models only in a signed-in session, so they appear after its first reply.
Until then it uses its own default.
Choose **Refresh models** after the first reply.

**A browser opens.**
When Antigravity's sign-in has expired, a reply signs in again with Google in your default browser.

## Cursor

**A second Cursor provider is refused on macOS.**
On a Mac every Cursor sign-in is shared, your own Cursor CLI's too, so TeamRun takes one Cursor provider per Mac.
Signing it out also signs out your own Cursor CLI.

**Every message is answered with a request to upgrade.**
Your Cursor plan doesn't include the chosen model.
Choose another model.

**Your git or gh settings are missing in a Cursor turn.**
On Linux and Windows, each Cursor provider keeps its own settings folder, so commands Cursor runs don't find your own settings that live in that folder, such as gh's sign-in on Linux, or gh's and npm's folders on Windows.

**A chat starts a new session.**
When Cursor no longer has a chat's session, the reply starts a new one and says so.

Cursor can't fork, compact its context, report plan usage, show sub-agents or use a team's MCP servers in TeamRun.

## fx

**fx isn't found on Windows.** fx has no Windows release yet.

**A second fx provider is refused.**
TeamRun takes one fx provider per computer, since it uses your own fx and its sign-in.

**fx shows signed out.**
Signed out, fx refuses to start a session.
Choose **Sign in** on its row, which runs `fx login`.

fx can't fork, compact its context on request, report plan usage, show sub-agents or stop a background command in TeamRun.

## Pi

**A sign-in check or a turn fails naming two versions.**
TeamRun needs Pi 1.1.0 or later.
Update Pi.

**Pi shows signed out, saying to choose a model in Pi.**
Pi has no default provider or model set.
Choose one in Pi itself, then refresh the provider.

**Signing in.**
**Sign in** opens Pi in a terminal: type `/login`, then `/quit`.
TeamRun checks the sign-in when Pi quits.

Pi can't report plan usage, show sub-agents or run background commands in TeamRun, and a team's MCP servers stay off in Pi chats.

## Still stuck?

Ask for help, share an idea or report a bug in [TeamRun's GitHub issues](https://github.com/noldova-com/teamrun/issues).
When reporting a problem, include your TeamRun version, operating system and steps to reproduce it.
Remove personal information and credentials from screenshots or logs.
