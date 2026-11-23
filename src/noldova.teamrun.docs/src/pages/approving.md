# Following and approving the work

While a teammate works, its reply shows what it does, step by step. When it needs your permission or an answer, the reply asks you, and the teammate waits. This page covers what a reply shows and how you answer it.

## What a reply shows

### Steps

Each step a teammate takes, such as reading a file, running a command or editing a file, is a row in the reply's **Activity**. A step is titled in plain words, such as a search or a read of a file, and opening it shows the exact command and its output.

While the reply works and its Activity is folded, one line under **Working for…** shows the step running now.

A step you denied shows **Denied**, not Failed.

Text a teammate writes between its steps shows in place while it works. Once the reply ends, that text moves into the Activity, and the reply's answer below it starts after the last step.

### What changed

Before each reply, TeamRun takes a checkpoint of the chat's folder, and after it compares the folder with it. The reply then lists the files its own tools changed, and the **Changes** panel lists them for the whole chat. Files that changed while the reply ran but not by its tools, such as by a pull or another program, get their own note: "changed while this reply ran, but not by its tools". More on checkpoints is on [Projects and folders](projects.md#checkpoints).

### When a reply ends

A finished reply ends with **Copy**, its time, and a figures button. The figures show what the provider reported: tokens in and out, cost, context, time worked, and the model and effort. A figure the provider doesn't report is left out.

A screen reader hears "*teammate* replied" when a reply ends, and "*teammate* asks: …" when a card appears.

## Plans and Plan first

### The plan

A teammate keeps work of several steps in its own plan. TeamRun shows it in the reply as one block, with the plan's title and its progress, such as "1 of 3". Opening the block shows the plan and its checklist, and the **Plans** panel lists every plan in the chat.

Once a reply ends, a step it left in progress shows as not done.

### Plan first

With **Plan first** on for a chat (see [Chats and teammates](chats.md#plan-first)), each teammate first plans in its provider's plan mode, which changes nothing, and waits for your approval:

- **Claude** and **Grok** hand over their plan and ask you to approve it on a card.
- **Cursor**'s plan card asks you to **Approve plan** or **Keep planning**.
- **Codex** ends its planning turn with its plan, and **OpenCode** and **GitHub Copilot** with an answer, which becomes the plan. The plan card then shows **Approve plan**. Approving sends "Go ahead with the plan." for you, and the teammate goes on in its usual mode.

Writing to the teammate instead of approving starts another planning turn. A refused plan shows **Not approved**, and an approved one **Approved**.

Plan first holds for each teammate on its own: once a teammate's plan is approved, its later replies run as usual, while the others still plan first. Turning Plan first on again makes every teammate plan first again.

The other providers' plan modes show only their checklist.

## Sub-agents

A teammate can start sub-agents: helpers that work on part of the task. Each shows as one row in the reply's Activity, with its type, description, status and time. Opening it shows its plan, its model and usage, its summary or result, and its own steps.

The **Sub-agents** panel lists the chat's sub-agents as cards, under **Finished** and **Running**. Its tab counts the sub-agents running now. A running card has **Stop sub-agent**, and **Open transcript** shows its row in the chat.

A provider's own sub-agents that run in the background:

- **Claude**, **Grok** and **Codex**: keep running after the reply, and wake the chat with their results.
- **GitHub Copilot**: holds the reply open until they end, so no one can send it a message until then.
- **OpenCode**, **Cursor** and **Antigravity**: end with the reply.

## Background tasks

A teammate can leave a command running in the background, such as a build or a server. The **Background tasks** panel lists the chat's tasks under **Running** and **Finished**, each with its command, status, time and output. Each running task has a Stop, and **Clear finished tasks** clears the finished ones.

A reply's header counts its tasks still running, such as `2 tasks running`. A Claude or Codex task can outlive its reply. When a task ends, the provider may start a new reply on its own, which shows as a new reply from the same teammate.

Nothing reruns after a restart: a task still running when TeamRun closes is saved as stopped.

## Permission requests

When a teammate wants to do something its mode doesn't allow by itself, the reply shows a permission card, and the teammate waits. The card shows:

- what the teammate asks to do, its details, and its risk;
- who asks, such as `Codex · command`, `Claude Code · file change` or `Copilot · tool`;
- when it expires: five minutes after it was asked.

A card shows up to 12 lines of details, and **Show all N lines** for a longer one.

Most cards offer **Allow once** and **Deny**, and some offer more:

- Computer use's requests for the screen or for an app offer **Allow in this chat** in place of Allow once. The teammate then keeps that access in this chat. You can revoke it on the **Computer use** page; see [Tools teammates use](tools.md#computer-use).
- The Browser's requests can offer **Allow for this chat** or **Allow this site for the workspace**, and **I'll type it myself**, which puts you in the field to type it yourself.

While a request waits, the reply and its chat in the Projects list say **Waiting for permission**.

A teammate in an unrestricted mode doesn't ask, except for a high-risk request, which always waits for you. Computer use's access to the screen or an app also always comes from you.

Only you answer a request, in the window. No command answers one.

### What a Browser step says

A Browser step says how it was decided, such as `you allowed it`, `allowed earlier`, `low risk, allowed`, `allowed by this chat's mode` or `you typed it yourself`. Opening a page on a site the project already allows is low risk and goes ahead without asking. Before the first card, one line lists the Browser steps that went ahead without asking.

## Questions

A teammate can stop to ask you questions. The reply shows a card, "*name* asks you", with each question, its options, **Pick any** when it takes several choices, and an **Other…** field when you may type your own answer. **Answer** waits until every question has an answer; **Skip** answers none. While only questions wait, the reply says **Waiting for your answer**.

Once answered, the card folds to each question with its answer. A secret answer shows as hidden and is never stored.

Which providers ask this way:

- **Claude**, **Codex**, **GitHub Copilot**, **Grok** and **Antigravity** ask with a card. Antigravity offers one choice and no text of your own.
- **Cursor** sends no questions today.
- **OpenCode** and **fx** ask in plain text in their reply, and you answer with a message.

A sub-agent's question or request names it on its card.

## Stop

A working reply has **Stop** at the end of its footer. Stop ends the reply and its running sub-agents, and closes its open cards. A stopped reply hands off to no one.

A reply whose turn has ended keeps its Stop while one of its sub-agents still runs.
