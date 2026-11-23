# Settings

TeamRun's settings are on the **TeamRun** page of Settings.
This page lists each one by its group, with its default.

Some settings belong to this computer only: **Send a message with** and **While a reply runs, Enter**.
The others apply wherever you use TeamRun.

## Replies

**Teammate hand-offs**, 4 by default, from 0 to 100: how many times in a row a teammate may start another reply, either the teammates its reply mentions or a chat it sends a message to.
At 0, a teammate starts no one.
Your own messages are never limited.
A change applies from the next hand-off.

## Chats

**Title model** chooses the model that names a new chat from its first message.

- The default, **Same as the chat**, is the model answering that first message: the one mentioned, or the first one mentioned when there are several.
- Naming a chat makes one extra request on that model, which counts against its plan.
  When you choose a model of another provider, first messages also go to that provider.
- The title is written in a separate session, without TeamRun's tools, where every permission request is refused.
- If the model can't answer, the chat's model is asked; if that fails too, the title stays the first characters of the message.

Only providers that can name a chat are offered.

## Composer

**Send a message with**, **Enter** by default, or **Ctrl+Enter (Cmd+Enter on macOS)**.
With Enter, Shift+Enter starts a new line; with Ctrl+Enter, Enter starts a new line.

**While a reply runs, Enter** chooses what Enter does with a message you type while a teammate's reply runs:

- **Steer**, the default, puts it into the running reply, or queues it where the reply's provider can't take one.
- **Queue** sends it once the replies end.
- **Stop and send** stops the replies and sends it.

The other two keep their own keys: Alt+Enter queues, and Ctrl+Enter, or Cmd+Enter on macOS, stops and sends.

## Images

**Open images** in a **Popup**, the default, or in a **Tab** beside your chats.

## Organization

**Show messages moving in the organization**, on by default, shows each message moving along the lines of the Organization view's Tree, from the one who writes it to the one it goes to.
Off, or when your system asks for reduced motion, the Tree stays still.
More on [Organization](organization.md).

## Terminals

**New terminals** chooses whether a terminal opened from the terminal panel's **+**, Toggle Terminal's first open or the shell menu is **General**, the default, or belongs to **This chat** and shows only with that chat.
New terminal and New chat terminal open their own kind either way.

**Run opens in** chooses where a reply's **Run** shows the terminal its code runs in: **Chat**, the default, under the code in the chat, or the chat's terminal in the **Terminals panel**.
A change applies from the next Run.

## Default teammate

**Choose default teammate** sets the provider, model and effort a new chat starts with.
Until you choose one, a new chat starts from the last message you sent.

The default teammate also answers a message sent from [the teamrun command](command.md) that names no teammate.

## Teammates and providers

- **Manage teammates** opens the teammates you bring into chats, each with its provider, model, effort and role.
  Each teammate's own settings, such as what happens [when usage runs out](sustain.md), are in its dialog.
- **Manage providers** opens the providers TeamRun uses on this computer.
  See [Providers](providers.md).
- **Manage MCP servers** opens the shared MCP servers you add, and the ones each provider's own configuration names, which stay off until you switch them on for that provider.
  See [Tools](tools.md).
- **Manage computer use** lists the apps, and the screen, you allowed a chat to control.
  Revoke an app, and the chat's next input to it is refused; revoke the screen, and the chat's next session asks for it again.

**Compact idle Claude chats**, on by default: a Claude chat with a large context, 150,000 tokens or more, is compacted 54 minutes after its last turn, while Claude's one-hour prompt cache still holds it.
Your next message then starts from a summary instead of paying to write the whole chat to the cache again.
It never happens while a turn, background task or sub-agent runs, and the chat shows a row when it does.
Off, no chat is compacted while idle.

## Outside sessions

**Outside sessions**, off by default, lets a coding agent running outside TeamRun on this computer list your recent chats, post into them or into a teammate's own chat for outside messages, and read the replies to its own messages.
Its messages show as coming from outside TeamRun, and teammates treat them as from an unknown sender.
Turning it off stops every outside session at once.

**Outside port**, 47391 by default, from 1024 to 65535: the port where outside sessions reach TeamRun.
Choose another when this one is in use.

**Connect outside agents** shows the address and token to copy into the outside agent's MCP settings, and **Reset token**, which stops every outside session until it has the new token.

## Data

**Data folder** is where TeamRun keeps its database.
**Show in folder** shows the database file in your system's file manager.
[The teamrun command](command.md) uses the same folder.
What TeamRun keeps there is on [Privacy and network](privacy.md).

## What each provider can do

Settings also has a page **What each provider can do**: pick a provider, and it shows each ability TeamRun knows, whether it works, or why it doesn't yet.
See [Provider features](provider-features.md).

## Settings of the app around TeamRun

- **Check for updates** chooses when TeamRun looks for a newer version.
  Its choices are on [Install](install.md#updates).
- Times follow the app's time format and its date-and-time format: a reply's time, a plan's reset today, and the date and time of a later reset, a computer use grant and a chat's tooltip in the Projects view.
  A change shows at once.
  Without a format set, times use the 12-hour clock, such as 6:00 PM.
