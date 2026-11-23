# Getting started

This page takes you from a first install to a first answer from a teammate.
If TeamRun isn't on your computer yet, start with [Install](install.md).

## 1. Add a provider

A provider is one AI service TeamRun runs for you, such as Claude Code, Codex or GitHub Copilot, signed in on your own account.

The first time you open TeamRun, it opens the **Providers** tab with a welcome line, and it already searches your computer for providers you use.
The tab has three parts:

- **Your providers:** the providers you have added, grouped by kind.
- **Found on this computer:** folders of providers you already use outside TeamRun, such as a Claude Code or Codex you signed in to before. Choose **Add** on one to add it as it is.
- **Add provider:** a card for each kind, with whether it is installed.

To add a new one, choose **Add provider** and pick a kind.
TeamRun fills in a name for it, such as Personal or Work, which you can change.
**Add** then installs the provider when TeamRun installs that kind itself, or shows the provider's own install command and runs it in a terminal below the panel.

Later, **Add a provider** in the composer and Settings' **Manage providers** open the same tab.
Each provider's install and sign-in are on [Providers and sign-in](providers.md).

## 2. Sign in

A newly added provider starts its sign-in as soon as it is saved.
Depending on the provider, its sign-in opens in your browser or runs the provider's own login command in a terminal, and the provider's row says which.
A folder found on your computer may be signed in already; if not, choose **Sign in** on its row.

When the sign-in ends, TeamRun checks it, and the row shows your account and plan where the provider reports them.
TeamRun never sees your password or token: each provider's own tool keeps its sign-in, as [Privacy and network](privacy.md) says.

## 3. Make your first teammate

At the bottom of the welcome tab, **Continue** turns on once a provider is signed in; **Skip for now** leaves the setup for later.

**Continue** shows **Your first teammate**:

- **Name**, filled in after the provider's kind, such as Codex, followed by its @mention.
- **Answered by**, the provider that answers for it.

Its model, effort and permissions start at the provider's defaults.
**Choose now** opens the full teammate dialog to set them; **Not now** makes nothing.

**Start chatting** makes the teammate and starts your first chat with it.

## 4. Start a chat

**New chat** in the sidebar starts a chat.
A chat with no project works in a folder of its own, so you can start without choosing a folder; **Open a folder** in an empty chat works in one of yours instead.
More on chats and folders is on [Chats and teammates](chats.md) and [Projects and folders](projects.md).

A new chat is named after its first message, and then a model writes it a better title.
That title is one more request to the provider, counted against its plan.

## 5. @mention a teammate

Type `@` and a teammate's name in your message to choose who answers; TeamRun offers the names as you type.
The teammate you mention is the one who answers.

The composer's picker, the button that reads like `@Codex · <model> · <effort>`, shows who answers and lets you choose the **Model** and **Effort**, and **Speed** when the model has speeds.
For a named teammate, those choices apply in this chat only; **Make it @<name>'s default** saves them to the teammate.

## 6. Approve its first step

When the teammate wants to run a command, change a file or use a tool, its reply shows an approval card where it asked.
The card names the provider and the kind of step, such as `Codex · command` or `Claude Code · file change`, with its risk and details.
Allow it or deny it; a card you don't answer expires five minutes after it was asked.

How much a teammate asks depends on its permission mode.
The composer's permission button opens **Permissions in this chat**, with the modes its provider offers and what each allows.
A mode that lifts the provider's restrictions asks you to confirm first.
Where the provider can plan, **Plan first** makes the teammate plan for your approval before it changes anything.

More on approvals is on [Following and approving the work](approving.md).
