# Projects and folders

Every chat works in a folder: its teammates read and change files there, and its terminals start there. A project is a folder you open in TeamRun, and its chats work in it. A chat can also have no project and work in a folder of its own.

## Projects

**Open folder** in the Projects view opens a folder as a project. Opening a project selects it, so **New chat** starts a chat there.

The Projects view lists:

- **Pinned** chats first;
- your organizations, covered on [Organization](organization.md);
- **Projects**, each with its chats;
- **Chats**, the chats without a project, newest first, ten until **Show more**.

You can drag projects and chats into the order you want; the order survives a restart and shows in every window.

Forgetting a project removes it and its chats from TeamRun and asks you first. The folder's files stay.

### A missing folder

When a project's folder is missing, can't be read, or doesn't answer within a few seconds, as on a disconnected drive or share, its name shows muted with a "Folder missing or unreachable" mark. A reply in its chats fails before the teammate starts, with a note naming the folder. Restore the folder, or move the chat with its menu's **Move to another project…**. The next reply runs once the folder is back.

## Chats without a project

**New chat** with no project open, or from a chat without a project, starts a chat that asks for no folder. It works in a folder of its own inside TeamRun's data folder, and starts with an empty Git repository of its own, so a teammate's search stops there.

Its menu offers:

- **Move to project…**, to move it into an open project. When its folder holds files, TeamRun first says how many it copies into the project's folder, and that the chat's own Git history isn't copied.
- **Move to a folder…**, to open a folder as a project and move the chat there.
- **Attach a folder…**, to work in an existing folder in place, with nothing copied. Then **Replace the folder…**, which asks first, and **Detach the folder**, which takes the chat back to its own folder.

Deleting a chat without a project whose folder holds files says how many files it removes, and offers **Move to a folder…** to keep them. Deleting a chat with an attached folder leaves that folder and its files as they are.

A move, attach or detach is refused while a reply or a teammate's background work still runs in the chat; the refusal names that work.

## Checkpoints

Before each reply, TeamRun takes a checkpoint of the chat's folder. After the reply, it compares the folder with that checkpoint, and the reply lists the files its tools changed, with their diffs. The **Changes** panel shows them for the whole chat.

- Files Git ignores, such as build output, are left out of the list, but the checkpoint still keeps every file.
- A reply lists at most 1,000 changed files and 4 MiB of diffs. Past that, it says the list is incomplete.
- Files that changed while none of the reply's tools ran, such as by a pull or another program, get their own note on the reply, not the Changes panel.
- A command that ran in a folder outside the chat's folder gets a note that changes made there aren't listed.

Checkpoints need no Git, so a folder without Git has them too. They never touch your project's own Git.

### Rewind

Rewinding a chat to one of your messages removes it and what came after, gives the message back in the message box, and can restore the files those replies changed from the checkpoint. The restore covers only the paths the removed replies changed. A file changed by something else, such as a pull or your own edit, stays as it is. When TeamRun can't be sure a reply listed every file it changed, the whole folder is restored instead.

The chat's default teammate keeps its provider session through a rewind when the provider can fork it: Claude Code, Codex and Grok. GitHub Copilot, OpenCode, Cursor and Antigravity can't, and the rewind dialog says so. Then the next reply starts a fresh session that is told what was said before. A named teammate always starts a fresh session the same way.

## Git and GitHub in a chat

The **Git** view shows the folder the chat on screen works in.

A GitHub link to an issue or a pull request in a message, yours or a teammate's, shows as a chip with GitHub's mark. Its card shows the item's state, number, title, repository and author, and each part opens its page on GitHub. Text written as `owner/repository#123` counts too. A bare `#123` counts as an item of the chat's repository, when the folder's Git remote is on `github.com`.

The message's text stays as typed, so Copy keeps the plain link. Signed out of GitHub, offline, or with the GitHub module off, a link stays a plain link, and nothing asks you to sign in. Once you sign in, or the module starts, the chips come back.

What a GitHub sign-in connects to is on [Privacy and network](privacy.md).
