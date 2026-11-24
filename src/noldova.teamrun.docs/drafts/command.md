# The teamrun command

TeamRun has a command line.
You can use it to list and open projects and chats, send messages, and check providers, and your teammates use it to message teammates in other chats.

Each command runs as the app's command followed by `teamrun` and the command's name.
On this page, `<app command>` stands for the app's command.

For example: `<app command> teamrun list-chats`

Add `--json` to any command to get its result as JSON.

The command works on the same data as the TeamRun window, in the [data folder](../src/pages/settings.md#data).

## Projects

| Command | What it does |
|---|---|
| `list-projects` | Lists the projects: id, name and folder. |
| `open-folder <folder>` | Opens a folder as a project, or gives the project already open there. A relative folder is read from the current folder, and a leading `~` is your home folder. A folder that isn't there is refused. |
| `forget-project <projectId>` | Forgets a project and deletes its chats and their messages. The folder's files stay. |

## Chats

| Command | What it does |
|---|---|
| `list-chats [--project <id>]` | Lists the chats of every project and those without one, or of one project: id, title, teammates, and whether a reply is running. |
| `new-chat [<projectId>] [--title <title>]` | Starts a chat in a project, or a chat without a project in an empty folder of its own. |
| `rename-chat <chatId> <title…>` | Renames a chat. |
| `delete-chat <chatId>` | Deletes a chat and its messages. |
| `move-chat <chatId> <projectId>` | Moves a chat to another project. |
| `search <text…> [--limit <count>]` | Lists the chats whose title or messages hold the text, ignoring case, the latest active first: 20 at most by default, and 100 at most. Each shows where the text is: in the title, or a message's number and the text around it. |
| `list-messages <chatId> [--before <sequence>] [--limit <count>]` | Lists a chat's latest messages, 20 by default, or those before a message number. Your own messages are by `User`; a message a teammate sent from another chat names the teammate and that chat. |
| `rewind <chatId> <messageId> [--restore-files]` | Removes a message and every message after it, and says whether the teammate's session goes on from there or the next reply starts a new one. With `--restore-files`, it also puts back the files the removed replies changed, where it can, and says why when it can't. |
| `list-approvals <chatId> [--pending]` | Lists a chat's approvals and questions, or with `--pending` only those still waiting for an answer. |

## Sending a message

To send a message: `<app command> teamrun send <chatId> <text…>`

`send` sends a message as the window does: `@` mentions name teammates.
It prints the ids of the message and of the replies it started, without waiting for the replies.

- `--teammate <name>` chooses the teammate who answers.
- With no teammate named, the default teammate set in [Settings](../src/pages/settings.md#default-teammate) answers, not the one chosen in the chat's composer.
  With no default teammate set, `send` refuses.
- `--provider <id>`, `--model <id>` and `--effort <level>` change who answers and how.
  `--model` without `--effort` answers at the model's own default effort.
  An effort for a provider that can't choose one is refused, with the reason, before anything is sent.
- `--kind <kind>` needs a `--provider` of that kind.
- With `-` alone as the text, `send` reads the message from standard input, such as a file piped into it.

To stop a chat's replies: `<app command> teamrun cancel <chatId>`

`cancel` stops the chat's working replies, hand-offs among them, and names the ones it stopped.

No command answers an approval: only you answer one, in the window.
See [Approving](../src/pages/approving.md).

## Providers and teammates

| Command | What it does |
|---|---|
| `list-providers` | Lists the providers and their sign-in. |
| `check-provider <providerId>` | Checks a provider's sign-in. |
| `add-provider <kind> <label>` | Adds a provider with a new profile folder, and prints its id. You sign it in from TeamRun's window. Some kinds take one provider at most. |
| `remove-provider <providerId>` | Removes a provider and leaves its profile folder as it is. A default teammate that used it has no provider until you choose one. |
| `list-models <providerId>` | Lists a provider's models: id, name, efforts, and which is its default. |
| `list-teammates` | Lists the teammates, each with its provider, signed-in account, model and effort, chats, whether it is answering now, and its usage. |
| `live-check --provider <id> [--prompt <text>]` | Runs one reply of a provider from start to end, at its default model, and prints it. By default the prompt asks for the word PONG. |

`live-check` runs in a chat of its own that it deletes after.
It fails when the reply doesn't complete, and stops a reply that asks for an approval.
If you end it early, with Ctrl+C or `--timeout`, the reply keeps running in the chat `Live check`: find it with `list-chats`, stop it with `cancel <chatId>`, and remove it with `delete-chat <chatId>`.
A chat it can't delete is named, for you to remove with `delete-chat`.

## How teammates use it

Each teammate's instructions tell it how to reach teammates in other chats with this command, whichever provider it runs on, on Windows, macOS and Linux.
It isn't set up in WSL's shells.

- A message a teammate sends with `send` during its turn is sent as that teammate, never as you, and the other chat shows who sent it and from which chat.
- In the other chat, the teammate named in the message answers, or the one given with `--teammate`, or else the one chosen in that chat's composer.
  When that is the sender itself, or none is chosen, the message is posted and no one starts.
- The answer comes back the same way.
- A chain of such messages stops at **Teammate hand-offs** in [Settings](../src/pages/settings.md#replies), 4 by default.

When you run `send` yourself, outside a teammate's turn, it sends as you.
