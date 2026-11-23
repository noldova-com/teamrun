# Chats and teammates

A chat is where you and your teammates work together.
Each teammate is an AI agent on one of your providers, with its own name, role, model and settings.
This page covers who answers in a chat, how you choose their settings, and how you write to them.

## Teammates and the default teammate

A teammate has a name, a role, a provider, a model, an effort, and on some providers a speed, a context window and a permission mode.
You add, change and remove teammates on the **Teammates** page, which you open from TeamRun's Settings page or the View menu.

A chat with no teammate is answered by the **default teammate**, which you choose in Settings.
Its replies show under its provider's name, such as "Codex".
Until you choose one, a new chat starts with the settings of the last message you sent.

A teammate on a provider that is turned off shows greyed, with "(provider disabled)" after its name, and doesn't answer until you turn the provider back on.
How to add providers is on [Providers](providers.md).

## Who answers

The picker at the bottom of the chat reads "who · model · effort".
"Who" is the teammate who answers, as an @mention, or the provider's kind when no teammate answers.
Its menu holds:

- **Model** and **Effort** side by side, and **Speed** under Effort when the model has speeds.
- The provider row, to switch to another provider.
  Without a teammate it also opens **Provider type**.
- For a named teammate, **Edit @name** and **Answer without a teammate**.

For a named teammate, a model, effort or speed you pick here applies in this chat only.
**Make it @name's default** saves them to the teammate, and the chat follows the teammate's own settings again.

## Models, effort and speed

TeamRun keeps no list of its own: each menu offers what the provider lists for the chosen model.

- **Effort** shows the provider's own names for its levels.
  The provider's default carries a **Recommended** tag.
  With no level chosen, the provider's own configuration or default applies, or **Model default** when the provider names neither.
  A model with no levels has Effort turned off.
- **Speed** shows the provider's own choices.
  Claude offers Standard and Fast for a model that supports fast mode.
  Codex offers its service tiers. fx offers Standard and Fast.
  When the provider says the chosen speed can't serve, the composer says so, with the provider's reason and the speed the reply ran at.
- **Context window**, in the teammate's settings, chooses when a long chat is summarised.
  Claude offers 200K, 400K or 1M, or any size from 100K up to the model's window.
  Codex offers 128K, 256K or 500K, or any size from 64K up to the model's window.
  **Default** uses the model's own window.

A Codex teammate with no model or effort chosen runs what your own Codex configuration names.
TeamRun never overrides it.

## Permission modes

A permission mode says how much a teammate may do without asking you.
The modes are the provider's own, by the provider's names:

| Provider | Modes |
|---|---|
| Claude | Auto, Manual, Accept edits (the default), Plan (read-only), Bypass permissions (unrestricted) |
| Codex | Read Only, Default, Full Access (unrestricted), Plan (read-only) |
| GitHub Copilot | Agent (the default), Plan (read-only), Autopilot (unrestricted), Allow All (unrestricted) |
| Grok | Default, Plan (read-only), Ask (read-only), Always-approve (unrestricted) |
| OpenCode | Build (the default), Plan (read-only), Allow All (unrestricted) |
| Cursor | Agent (the default), Ask (read-only), Plan (read-only), Allow all (unrestricted) |
| fx | Auto (the default), Ask, Full access (unrestricted) |
| Pi | Ask first (the default), Read only, Allow all (unrestricted) |
| Antigravity | Default, Auto Edit, YOLO (unrestricted) |

Cursor has no mode that asks nothing, so its Allow all is TeamRun's own: Cursor runs in Agent and TeamRun allows each of its requests.
Pi has no permission system of its own, so all three of its modes are TeamRun's.

You set a mode in two places:

- A teammate's **Permission mode**, in its settings, is its default for every chat.
- The permission button beside the picker sets the mode for this chat only.
  Its menu, **Permissions in this chat**, lists the modes with what each allows, marks the teammate's default, and ends with a row that opens the teammate to change its default.

Choosing an unrestricted mode asks you to confirm first.
While a teammate runs in one, the permission button shows a warning sign in place of its shield.
Even then, a high-risk request still waits for you; see [Following and approving the work](approving.md).

TeamRun's own tools follow the chat's mode too.

### Plan first

When the provider has a plan mode, the permissions menu adds **Plan first**: "Plans for your approval before it changes anything".
With it on, each teammate first writes a plan and waits for you to approve it, then goes on in its usual mode.
How plans show and how you approve them is on [Following and approving the work](approving.md#plans-and-plan-first).

## Writing to teammates

### @mentions

Type `@` and a teammate's name to address it.
A full name or its first word is enough.
Every teammate you name in your message answers.
A name inside code doesn't count.

When the message names no one, the teammate chosen in the picker answers.

### Hand-offs

A teammate can hand work to another teammate by addressing it at the start of its reply or of a line, as in `@Bob, @Carol: please check`.
A name in the middle of a sentence or inside quotation marks hands nothing off.

Teammates can also send messages to other chats, and the teammate there answers.
The answer comes back the same way.

A chain of hand-offs stops at the **Teammate hand-offs** limit in Settings › TeamRun: from 0 to 100, and 4 by default.
Your own messages are never limited.
When you stop a reply, it hands off to no one and says so, as in "Stopped before handing off to Bob."

### Messages sent while a reply runs

The message box stays open while a teammate replies.
A message you send then goes one of three ways:

- **Steer** puts it into the running reply, once the reply can take it.
- **Queue** waits and goes as the next turn when the replies end.
- **Stop and send** stops the running replies and goes first.

Enter uses the way a Chat setting in Settings names, Steer by default.
Alt+Enter queues, and Ctrl+Enter (Cmd+Enter on macOS) stops and sends.
The split button beside Stop offers each way with its key.

Codex, Pi and Grok take a steered message.
Claude Code answers one only after the reply it went into.
The other providers can't take one, so the message waits as a queued one, and the list says why.

Waiting messages show above the message box.
Each one's menu holds **Edit**, **Send now** and **Remove**.
Up in an empty box edits the last one.
Waiting messages survive a restart.

### Slash commands

A message that is only a `/` command, such as `/review src`, goes to the provider as its own command when the provider lists it.
A command the provider doesn't list gets a note naming the commands it does list.
A command goes only alone, without files.

## Attachments

Add files with the composer's **Add files**, or paste or drop them.
An image can be up to 10 MiB, and any other file up to 100 MiB.

Clicking an attached file opens documents, text and data files in their usual app.
Any other file, such as a program, is shown in its folder instead, and never run.

## Search

TeamRun uses the window's one search, with two sources:

- **Chats** finds chats whose title contains what you type.
  Before you type, it shows the 20 chats updated last.
- **Messages** finds the text of messages, not teammates' reasoning or steps.
  Each result shows a snippet, who wrote it, its chat and how long ago; opening it opens the chat at that message.

The command **Search chats** opens the search on Chats.
A search of one or two characters looks only through the latest 2,000 messages.
Counts stop at 1,000.

## Chat titles

A new chat is named after its first message, and then a model gives it a better title in the background.
The **Title model** setting chooses which model; **Same as the chat** uses the model that answered.
This makes one more short request to that provider, counted against its plan.
A title you choose yourself is never replaced.
