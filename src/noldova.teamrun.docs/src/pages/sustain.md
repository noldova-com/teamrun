# When usage runs out

Sustain keeps a teammate's work going when its account reaches a usage limit.
The work moves on to the next account, model and effort you listed for that teammate, and comes back to the teammate's own choice once its usage resets.

## Turning it on

Sustain is set per teammate, in the teammate's dialog, under **When usage runs out**.
It is off for a new teammate.

1. Turn on **Continue elsewhere when a limit is hit**.
2. Under **Fallback order**, the first entry is the teammate's own account, model and effort.
   Change it in the teammate's own fields above.
3. Choose **Add** for each entry after it, and pick its account, model and effort.
   Entries can be moved up and down, and removed.

Your list stays when you turn Sustain off, so turning it back on needs nothing else.

Each entry after the first says what a move to it does:

- **Same session**: the teammate goes on in the same session, on another account of the same provider.
- **Same session, not yet checked**: the same, on a provider whose move between accounts hasn't been checked yet.
- **New session with handover**: the teammate starts a new session, which gets a handover of the chat.

### The entry whose usage resets soonest

**After the teammate's own choice, use the entry whose usage resets soonest first** is on by default.
With it on, once the teammate's own entry is out, TeamRun takes the entry whose plan resets earliest, so usage that would reset unused is spent first.
With it off, the list's order holds.

## Which providers it works with

Sustain works only with providers whose usage limits TeamRun can read: today, Claude and Codex.

TeamRun can't read the limits of GitHub Copilot, Cursor, Grok, OpenCode or Antigravity yet.
When you add an entry, they show greyed under **Can't read usage limits yet**, and can't be chosen.

A teammate whose own account is on such a provider can't turn Sustain on.
Its dialog says "TeamRun can't read <provider>'s usage limits yet, so neither Sustain nor a hand-off can start for this teammate."
Moving a teammate to such a provider turns its Sustain off.

## What moves a teammate

Only a usage limit.
Any other failure shows its error and moves nothing, such as:

- an expired sign-in: sign in again;
- a provider's outage;
- a model that isn't available;
- a short Claude rate limit that isn't a usage limit.

An entry whose sign-in has expired is still used; its turns fail with the sign-in error until you sign in again.

## Which entry a turn uses

At the start of each turn, the teammate's turn runs on the first entry that has usage left.
So once the teammate's own entry has usage again, its next turn goes back to it by itself.

A turn never changes entry while it runs.
Each reply shows which account, model and effort answered it.

When no entry has usage left at a turn's start, the turn runs on the first entry and its limit shows as an error.

## When a turn stops at a limit

A turn that reaches a limit keeps what it wrote and ends with a line such as "Stopped: Claude · Work reached its usage limit", then "It resets at 18:00" when the provider says when.

A continuation then runs at once, before any reply already waiting, on the next entry with usage left.
It answers the same message and goes on from what the stopped reply wrote.
A message you sent while the stopped turn ran gets its own reply after the continuation.

- **Stop** on the stopped reply, or cancelling the chat's replies, starts no continuation.
- Each entry is tried once for the same piece of work, so a teammate never goes round the list twice.
- Quitting TeamRun ends a continuation that hasn't started yet, like any reply still waiting.

When every entry has been tried or is out, nothing more starts, and the stopped line says why each entry was passed over, such as "Every Sustain entry is out: Claude · Work resets at 18:00, Claude · Personal at 21:30, Codex · Team on Nov 14 at 09:00".

## Same session or a handover

**Same session.**
Between two accounts of Claude, or two of Codex, TeamRun copies the session to the other account and goes on in it, so the provider keeps its own history.
It copies only the session, never a sign-in.
The session stays on the first account too, so a move back goes on in it.

The move uses a handover instead when:

- the provider is still running a background task or sub-agent in the session;
- the copy fails;
- for Claude, the session has already been compacted.

**A handover.**
A move to another provider, or one of the cases above, starts a new session whose first message is a handover of the chat.
It holds:

- the chat's first message, your original request;
- a summary of the earlier chat, when the session had compacted its context: the provider's own summary where TeamRun can read it, Claude's for example, or else a summary TeamRun asks the new account for, which costs that account one request;
- the newest messages, as many as fit;
- the message being answered, and what the stopped reply wrote, always whole.

Long tool results are cut to their start and end.
What doesn't fit is named by message number at the end of the handover, and the teammate reads those messages from the chat when it needs them.
An entry with no room even for that is skipped, and the next one is tried.

Moving to another provider and back is a handover each way.
No memories are copied, either way.

## What the chat shows

The reply that moves starts with a muted note, such as:

- "Moved to Codex, Team, GPT-5.5 because Personal reached its usage limit; same session"
- "Moved to Codex, Team, GPT-5.5 because Personal reached its usage limit; new session with a handover"
- "…; new session with a handover, since the session was still running a task"
- "Moved to Codex, Work, GPT-5.5 because its usage reset", for a return to the first entry.

A note with a handover ends with **Show handover**, which opens what the new session was sent and what was left out.
**Hide handover** folds it again.

## Handing off to another teammate

Under Sustain's settings, **Hand off to** lists other teammates who take over when this one is out of usage.
It is empty by default, shown as "Off: no teammate takes over."; choose **Add** to add teammates in order.

It applies at the start of a turn, when the teammate is out of usage and Sustain is off, or every Sustain entry is out:

- The reply runs no turn and shows a line such as "Builder handed off to Reviewer: out of usage".
- The first teammate on the list with usage left answers the same message, under its own name, instructions and settings, and joins the chat if it isn't in it yet.
- When no teammate on the list has usage left, the reply ends with a line that begins "Builder is out of usage, and no teammate it hands off to has usage left."
  Nothing more runs until you send again.

Each such hand-off counts toward **Teammate hand-offs** in [Settings](settings.md).
The work doesn't come back by itself: after the first teammate's usage resets, it answers only when it is asked again.

A turn that reaches its limit while it runs doesn't hand off; the teammate's next turn does.
Only a usage limit hands off: an expired sign-in or an outage shows its error.

A teammate on a provider whose limits TeamRun can't read can be on another teammate's list, but can't have a list of its own.
