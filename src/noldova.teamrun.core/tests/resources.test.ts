/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "@noldova/teamrun.core";

import { CodedError } from "./fixtures/coded-error.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public namesEverythingStillRunningInAChatsFolder(): void {
    const command = Resources.formatRunningCommand("npm test");
    const helper = Resources.formatRunningHelper("Check the tests");

    Assert.areEqual("This chat can't move to a project while the background command \"npm test\" is still running in its folder. "
      + "Stop it or wait for it to end, then try again.", Resources.formatChatWorkRunning(Resources.chatMoveChange, [command]));
    Assert.areEqual("This chat can't detach its folder while the background command \"npm test\" and the helper \"Check the tests\" are still running in "
      + "its folder. Stop them or wait for them to end, then try again.", Resources.formatChatWorkRunning(Resources.chatDetachChange, [command, helper]));
    Assert.areEqual("This chat can't attach a folder while the background command \"npm test\", the helper \"Check the tests\" and a teammate's background "
      + "work are still running in its folder. Stop them or wait for them to end, then try again.",
      Resources.formatChatWorkRunning(Resources.chatAttachChange, [command, helper, Resources.runningReplyWork]));
  }

  @TestMethod
  public namesTheDatabaseFileTablesAndColumns(): void {
    Assert.areEqual("teamrun.db", Resources.databaseFileName);
    Assert.areEqual("providers", Resources.providersTable);
    Assert.areEqual("updatedAt", Resources.updatedAtColumn);
    Assert.areEqual("20260908120000_Initial", Resources.initialMigrationId);
    Assert.areEqual("New chat", Resources.defaultConversationTitle);
    Assert.areEqual("The TeamRun window didn't answer.", Resources.windowDidNotAnswer);
    Assert.areEqual("The person is typing in TeamRun, so the panel was left as it is; ask again when they stop.", Resources.panelRefused);
    Assert.areEqual("The TeamRun window couldn't change the panel.", Resources.panelFailed);
  }

  @TestMethod
  public saysChatNeverConversationInEveryTextItHolds(): void {
    const values = Object.values(Resources).flatMap((t: unknown) => t instanceof Map ? [...t.values()] : [t]);
    const statements = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|WITH)\b/;
    const texts = [
      ...values.filter(Object.isString).filter(t => t.includes(" ") && !statements.test(t)),
      Resources.formatTranscriptPreamble("User: Hi", "Go on", true),
      Resources.formatParticipantContext("Carol", true, "User: Hi"),
      Resources.formatDraftFilesNotRemoved("c1", "busy"),
      Resources.formatDraftNotRead("c1", "busy"),
      Resources.formatWorkingTreeChanges("a.ts")
    ];

    Assert.isTrue(texts.includes(Resources.windowDidNotAnswer));
    Assert.areEqual("", texts.filter(t => /conversation/i.test(t)).join(" | "));
  }

  @TestMethod
  public namesTheModelInASustainMoveOnlyWhenTheEntryHasOne(): void {
    Assert.areEqual("Moved to Codex, Spare, gpt-5 because Work reached its usage limit; new session with a handover", Resources.formatSustainMoved("Codex", "Spare", "gpt-5", "Work"));
    Assert.areEqual("Moved to Codex, Spare because Work reached its usage limit; new session with a handover", Resources.formatSustainMoved("Codex", "Spare", null, "Work"));
    Assert.areEqual("Moved to Codex, Work, gpt-5 because its usage reset", Resources.formatSustainReturned("Codex", "Work", "gpt-5"));
    Assert.areEqual("Moved to Claude, Spare, opus because Work reached its usage limit; same session", Resources.formatSustainKept("Claude", "Spare", "opus", "Work"));
    Assert.areEqual("Moved to Claude, Spare because Work reached its usage limit; new session with a handover, since the session was still running a task",
      Resources.formatSustainHeld("Claude", "Spare", null, "Work"));
    Assert.areEqual("Moved to Codex, Codex because its usage reset", Resources.formatSustainReturned("Codex", "Codex", null));
    Assert.areEqual("Codex, Work|Codex, Codex", [Resources.formatSustainAccount("Codex", "Work"), Resources.formatSustainAccount("Codex", "Codex")].join("|"));
  }

  @TestMethod
  public namesEachSustainEntrysResetByTheTimeAloneOnTheSameDayAndWithItsDateAfter(): void {
    const now = new Date(2026, 10, 12, 9, 30);

    Assert.areEqual("Codex · Work resets at 18:05", Resources.formatSustainEntryReset("Codex · Work", new Date(2026, 10, 12, 18, 5).toISOString(), now, true));
    Assert.areEqual("Codex · Work at 18:05", Resources.formatSustainEntryReset("Codex · Work", new Date(2026, 10, 12, 18, 5).toISOString(), now, false));
    Assert.areEqual("Codex · Work resets on Nov 14 at 09:00", Resources.formatSustainEntryReset("Codex · Work", new Date(2026, 10, 14, 9, 0).toISOString(), now, true));
    Assert.areEqual("Codex · Work resets on Nov 12 at 09:00", Resources.formatSustainEntryReset("Codex · Work", new Date(2027, 10, 12, 9, 0).toISOString(), now, true));
    Assert.areEqual("Codex · Work on Dec 12 at 09:00", Resources.formatSustainEntryReset("Codex · Work", new Date(2026, 11, 12, 9, 0).toISOString(), now, false));
    Assert.areEqual("Codex · Spare hasn't said when it resets", Resources.formatSustainEntryReset("Codex · Spare", null, now, false));
    Assert.areEqual("Every Sustain entry is out: A resets at 18:05, B hasn't said when it resets.",
      Resources.formatSustainAllOut(["A resets at 18:05", "B hasn't said when it resets"]));
    Assert.areEqual("Claude · Work", Resources.formatStoppedAccount("Claude", "Work"));
    Assert.areEqual("Stopped: Claude · Work reached its usage limit. It resets at 18:00.",
      Resources.formatUsageLimitStopped("Claude · Work", Resources.formatUsageLimitResets(Resources.formatSustainResetTime(new Date(2026, 10, 12, 18, 0).toISOString(), now))));
    Assert.areEqual("Stopped: Codex · Team reached its usage limit.", Resources.formatUsageLimitStopped("Codex · Team", null));
    Assert.areEqual("Codex · Work already stopped at a limit in this reply", Resources.formatSustainEntryTried("Codex · Work"));
    Assert.areEqual("Codex · Off can't reply now", Resources.formatSustainEntryUnavailable("Codex · Off"));
  }

  @TestMethod
  public tellsAContinuationWhatItsStoppedTurnWroteOrThatItWroteNothing(): void {
    Assert.areEqual("Your last turn stopped at a usage limit after it wrote this:\n\nHalf done.\n\nGo on from where it stopped.", Resources.formatSustainContinued("Half done."));
    Assert.areEqual(Resources.sustainStoppedBeforeWriting, Resources.formatSustainContinued(""));
  }

  @TestMethod
  public tellsAJoiningTeammateWhoItIsAndNotThatItJoined(): void {
    Assert.areEqual("You are @Cursor, a teammate in this TeamRun chat. What was said before:\n\nUser: Hi",
      Resources.formatParticipantContext("Cursor", true, "User: Hi"));
    Assert.areEqual("New messages for @Cursor since your last reply:\n\nUser: Hi", Resources.formatParticipantContext("Cursor", false, "User: Hi"));
  }

  @TestMethod
  public composesTheCheckpointTexts(): void {
    Assert.areEqual("TeamRun, before reply r-1", Resources.formatCheckpointLabel("r-1"));
    Assert.areEqual("The project's folder is missing, so no files were restored.", Resources.formatRestoreRefusal("FolderMissing"));
    Assert.areEqual("No files were restored: the checkpoints module answered Later.", Resources.formatRestoreRefusal("Later"));
    Assert.areEqual("CheckpointMissing,FolderMissing,HeldUp,MovedOn,LowDiskSpace,RolledBack", [...Resources.restoreRefusals.keys()].join(","));
    Assert.areEqual("The checkpoints module took no checkpoint before the reply ending in \"23456789abcd\": Error.",
      Resources.formatCheckpointNotTaken("0192f3a4-5b6c-7d8e-9f01-23456789abcd", "Error"));
    Assert.areEqual("The checkpoints module couldn't compare the files the reply ending in \"23456789abcd\" changed: Error.",
      Resources.formatChangesNotCompared("0192f3a4-5b6c-7d8e-9f01-23456789abcd", "Error"));
  }

  @TestMethod
  public composesTheServiceMessages(): void {
    Assert.areEqual("The approval \"a\" does not exist.", Resources.formatApprovalNotFound("a"));
    Assert.areEqual("The approval \"a\" has already been decided.", Resources.formatApprovalNotPending("a"));
    Assert.areEqual("The background task \"t\" does not exist.", Resources.formatBackgroundTaskNotFound("t"));
    Assert.areEqual("The TeamRun window \"w\" was closed or reloaded.", Resources.formatWindowNotFound("w"));
    Assert.areEqual("The computer-use grant \"g\" does not exist or was already revoked.", Resources.formatComputerUseGrantNotFound("g"));
    Assert.areEqual("The task could not be stopped: gone", Resources.formatBackgroundTaskStopFailed("gone"));
    Assert.areEqual("The background task t of a teammate who left could not be stopped: Error.", Resources.formatTeammateTaskStopFailed("t", "Error"));
    Assert.areEqual("The chat \"c\" does not exist.", Resources.formatConversationNotFound("c"));
    Assert.areEqual("The draft's file \"a.txt\" does not exist.", Resources.formatDraftFileNotFound("a.txt"));
    Assert.areEqual(12, Resources.loggedIdLength);
    Assert.areEqual("The draft files of the chat ending in \"23456789abcd\" were not removed: EBUSY.",
      Resources.formatDraftFilesNotRemoved("0192f3a4-5b6c-7d8e-9f01-23456789abcd", "EBUSY"));
    Assert.areEqual("The draft of the chat ending in \"c\" was not read, so its files were kept: JsonException.",
      Resources.formatDraftNotRead("c", "JsonException"));
    Assert.areEqual("The message \"m\" does not exist.", Resources.formatMessageNotFound("m"));
    Assert.areEqual("The message \"m\" is not a running reply.", Resources.formatMessageNotOpen("m"));
    Assert.areEqual("The reply \"m\" has no provenance, so the provider that writes it is unknown.", Resources.formatReplyWithoutProvenance("m"));
    Assert.areEqual("The profile directory \"x\" is not absolute.", Resources.formatProfileDirNotAbsolute("x"));
    Assert.areEqual("The server path \"x\" is not absolute.", Resources.formatBinaryPathNotAbsolute("x"));
    Assert.areEqual("A provider of \"codex\" runs only the server TeamRun finds, so it takes no server path.", Resources.formatBinaryPathUnavailable("codex"));
    Assert.areEqual("Shared working-tree changes (may include other chats or tools): a.ts, b.ts", Resources.formatWorkingTreeChanges("a.ts, b.ts"));
    Assert.areEqual("Commands ran in or wrote to /tmp, outside this chat's folder; files they changed there without naming them aren't listed.",
      Resources.formatCommandsOutsideFolders("/tmp"));
    Assert.areEqual("Commands ran in or wrote to folders outside this chat's folder, /repo; files they changed outside it without naming them aren't listed.",
      Resources.formatCommandsOutsideFolder("/repo"));
    Assert.areEqual("Files commands changed outside this chat's folder: /tmp/a, /tmp/b", Resources.formatCommandWrites("/tmp/a, /tmp/b"));
    Assert.areEqual("Changed while this reply ran, but not by its tools: a.ts, b.ts", Resources.formatOutsideChanges(["a.ts", "b.ts"]));
    Assert.areEqual("Changed while this reply ran, but not by its tools: 1.ts, 2.ts, 3.ts, 4.ts, 5.ts",
      Resources.formatOutsideChanges(["1.ts", "2.ts", "3.ts", "4.ts", "5.ts"]));
    Assert.areEqual("Changed while this reply ran, but not by its tools: 1.ts, 2.ts, 3.ts, 4.ts, 5.ts and 2 more",
      Resources.formatOutsideChanges(["1.ts", "2.ts", "3.ts", "4.ts", "5.ts", "6.ts", "7.ts"]));
    Assert.areEqual("--- /dev/null\n+++ /tmp/a", Resources.formatDiffFiles(null, "/tmp/a"));
    Assert.areEqual("--- /tmp/a\n+++ /dev/null", Resources.formatDiffFiles("/tmp/a", null));
    Assert.areEqual("@@ -0,0 +1,2 @@", Resources.formatDiffHunk(0, 0, 0, 2));
    Assert.areEqual("@@ -4,3 +3,0 @@", Resources.formatDiffHunk(3, 3, 3, 0));
    Assert.areEqual("@@ -11,2 +13,3 @@", Resources.formatDiffHunk(10, 2, 12, 3));
    Assert.areEqual("This chat's folder wasn't compared after this reply, so changes its commands made aren't listed.", Resources.uncomparedWorkingTree);
    Assert.areEqual("--- /dev/null\n+++ b/a.ts\n@@ -0,0 +1,2 @@\n+x\n+y", Resources.formatAddedFileDiff("a.ts", ["x", "y"]));
    Assert.areEqual("m-3.png", Resources.formatImageFileName("m", 3, ".png"));
    Assert.areEqual("The project \"p\" does not exist.", Resources.formatProjectNotFound("p"));
    Assert.areEqual("The project's folder \"/repo\" is missing, so the reply didn't start. Restore the folder there, or move this chat with Move to another project… in its menu.",
      Resources.formatWorkFolderMissing("/repo"));
    Assert.areEqual("The project's folder \"/repo\" didn't answer in time, so the reply didn't start. Check that its drive or share is connected, then send again.",
      Resources.formatWorkFolderUnreachable("/repo"));
    Assert.areEqual("The folder attached to this chat, \"/site\", is missing or can't be read, so the reply didn't start. Restore the folder there, or attach another folder or detach this one in the chat's menu.",
      Resources.formatAttachedFolderMissing("/site"));
    Assert.areEqual("The folder attached to this chat, \"/site\", didn't answer in time, so the reply didn't start. Check that its drive or share is connected, then send again.",
      Resources.formatAttachedFolderUnreachable("/site"));
    Assert.areEqual("The folder \"/site\" is missing, can't be read or didn't answer in time, so it wasn't attached.", Resources.formatFolderNotAttached("/site"));
    Assert.areEqual("The folder \"site\" is not an absolute path.", Resources.formatFolderNotAbsolute("site"));
    Assert.areEqual("The chat \"c\" is in a project, which gives it its folder.", Resources.formatChatInProject("c"));
    Assert.areEqual("folder-abc", Resources.formatAttachedFolderId("abc"));
    Assert.areEqual("The provider \"a\" is not of the kind \"codex\".", Resources.formatProviderMismatch("a", "codex"));
    Assert.areEqual("The provider \"a\" does not exist.", Resources.formatProviderNotFound("a"));
    Assert.areEqual("The provider \"codex\" is already registered.", Resources.formatKindAlreadyRegistered("codex"));
    Assert.areEqual("The provider \"codex\" is not registered.", Resources.formatKindNotRegistered("codex"));
    Assert.areEqual("The chat \"c\" already has a reply in progress.", Resources.formatReplyInProgress("c"));
    Assert.areEqual("The root path \"x\" is not absolute.", Resources.formatRootPathNotAbsolute("x"));
    Assert.areEqual("The provider's turn failed: boom", Resources.formatTurnFailed("boom"));
    Assert.areEqual("The approval \"a\" offers no option \"o\".", Resources.formatUnknownDecisionOption("a", "o"));
    Assert.areEqual("The method \"x\" is not part of the protocol.", Resources.formatUnknownMethod("x"));
    Assert.areEqual(Resources.subAgentInstructions, Resources.formatSubAgentInstructions(null));
    Assert.areEqual(`Review.\n\n${Resources.subAgentInstructions}`, Resources.formatSubAgentInstructions("Review."));
    Assert.areEqual("No sub-agent named \"reviewer\" can run here; start \"explorer\" or \"helper\".", Resources.formatSubAgentUnavailable("reviewer"));
    Assert.areEqual("An explorer can't run on Grok, which has no read-only mode TeamRun can enforce; start \"helper\" instead.",
      Resources.formatExplorerUnavailable("Grok", null));
    Assert.areEqual("An explorer can't run on Codex: It can't promise read-only. Start \"helper\" instead.",
      Resources.formatExplorerUnavailable("Codex", "It can't promise read-only."));
    Assert.areEqual("TeamRun denied this, as an explorer changes nothing: Run rm a.txt", Resources.formatExplorerDenied("Run rm a.txt"));
    Assert.areEqual("This reply already runs 4 sub-agents; wait for one to end first.", Resources.formatSubAgentLimitReached(4));
    Assert.areEqual("This reply started no sub-agent s.", Resources.formatSubAgentNotFound("s"));
    Assert.areEqual("\n\n[5 more characters cut]", Resources.formatSubAgentResultCut(5));
  }

  @TestMethod
  public composesTheWakeOfASubAgentThatEndedAfterItsTurnCuttingALongSummary(): void {
    Assert.areEqual("Your sub-agent \"Check\" (a-1) ended as stopped, without a summary.", Resources.formatSubAgentWake("Check", "a-1", "Stopped", null));
    Assert.areEqual(`Your sub-agent "Check" (a-1) ended as completed:\n${"x".repeat(2000)}…`,
      Resources.formatSubAgentWake("Check", "a-1", "Completed", "x".repeat(2001)));
  }

  @TestMethod
  public namesTeamRunsToolsInsteadOfTheCommandLineWhenTheTurnHasThemSinceASandboxedShellCantReachTheApp(): void {
    const note = Resources.formatTeammateInstructions(null, "acme teamrun", true);

    Assert.areEqual(14, note.split("\n").length);
    Assert.isTrue(note.includes("\nA read-only mode refuses `teamrun_send_message`, so in one, answer such a message in your reply instead.\n"));
    Assert.isTrue(note.includes("\nTeamRun's tools read the app: `teamrun_list_chats` lists each chat with its teammates and whether a reply is running, "
      + "and `teamrun_list_teammates` lists every teammate with its provider, model, chats, usage, and its department and manager in each organization.\n`teamrun_list_messages` lists a chat's latest messages: "));
    Assert.isTrue(note.includes("\n`teamrun_list_projects`, `teamrun_list_approvals`, `teamrun_list_providers` and `teamrun_check_provider` list the projects, "
      + "a chat's approvals and the providers with how much of their plans is used, and check a provider's sign-in.\n"));
    Assert.isTrue(note.includes("\n`teamrun_send_message` sends a message to another chat, marked as from you and this chat, and doesn't wait for the answer, "
      + "which comes back to this chat as a new message: each teammate its text names as `@<name>` answers it, and when it names none, that chat's chosen teammate does.\n"
      + "With `wake_when_done` it wakes you with a new turn and the replies' last text once they end, so end your turn instead of waiting for them.\n"));
    Assert.isTrue(note.includes("\n`teamrun_run_in_background` runs a long shell command, such as a build or a test run, in this chat's folder and wakes "
      + "you with a new turn and its last lines once it ends, so end your turn instead of waiting for it.\n"));
    Assert.isTrue(note.includes("\n`teamrun_show_page` shows an HTML file you wrote in this chat's folder as a page the person sees in TeamRun: when asked to show "
      + "something as a page or a visual, or to make a page, a report, a dashboard, a chart or a mock-up, write it as an HTML file and show it with this tool, "
      + "never by serving it on a local port or opening it in a browser, which opens a local address only for a site the person allowed.\n"));
    Assert.isTrue(note.includes("comes from that chat's teammate, not from the person: answer it the same way, with `teamrun_send_message` to `<chatId>` "
      + "and a text that starts with `@<name>`, when it asks for an answer.\n"));
    Assert.isTrue(note.includes(`A message that begins \`${Resources.formatDefaultSenderPrefix("<provider>", "<title>", "<chatId>").trimEnd()}\` comes from that chat's `
      + "default teammate: answer it with `teamrun_send_message` to `<chatId>` and a text that names no teammate, and the chat's chosen responder answers.\n"));
    Assert.isTrue(note.includes(`\`${Resources.formatSenderPrefix("<name>", "<title>", "<chatId>", ["<other>"]).trimEnd()}\``));
    Assert.isFalse(note.includes("acme teamrun"));
    Assert.isFalse(note.includes("command line"));
    Assert.isTrue(note.endsWith("which is only for the tools."));
    Assert.areEqual("c1/t1", Resources.formatToolScope("c1", "t1"));
    Assert.areEqual("c1/default", Resources.formatToolScope("c1", null));
  }

  @TestMethod
  public asksEveryTeammateToKeepItsPlanInItsPlanToolWithOrWithoutTheCommand(): void {
    Assert.isTrue(Resources.planToolInstructions.includes("keep them in your own plan tool"));
    Assert.isTrue(Resources.planToolInstructions.includes("Never repeat the plan as a typed checklist, such as `- [ ]` or `- [x]` lines"));
    Assert.areEqual(Resources.planToolInstructions, Resources.formatTeammateInstructions(null, null));
    Assert.areEqual(Resources.formatTeammateInstructions(null, "acme teamrun", true), Resources.formatTeammateInstructions(null, null, true));
    Assert.areEqual(`Review carefully\n\n${Resources.planToolInstructions}`, Resources.formatTeammateInstructions("Review carefully", null));
    Assert.isTrue(Resources.formatTeammateInstructions(null, "acme teamrun", true).startsWith(`${Resources.planToolInstructions}\nTo hand this chat`));
  }

  @TestMethod
  public asksATeammateWhoseBackgroundSubAgentsDontWakeTheChatToWaitForThemAfterItsPlanLine(): void {
    const note = "Wait for your sub-agents.";
    const ends = `${Resources.planToolInstructions}\n${note}`;
    Assert.areEqual(ends, Resources.formatTeammateInstructions(null, null, false, note));
    Assert.areEqual(`Review carefully\n\n${ends}`, Resources.formatTeammateInstructions("Review carefully", null, false, note));
    Assert.isTrue(Resources.formatTeammateInstructions(null, "acme teamrun", true, note).startsWith(`${ends}\nTo hand this chat`));
    Assert.isFalse(Resources.formatTeammateInstructions(null, "acme teamrun", true).includes(note));
  }

  @TestMethod
  public composesATeammatesInstructionsWithTheNoteOnOtherChats(): void {
    const note = Resources.formatTeammateInstructions(null, "acme teamrun");

    Assert.areEqual(11, note.split("\n").length);
    Assert.isTrue(note.startsWith(`${Resources.planToolInstructions}\n`));
    Assert.isTrue(note.includes("\nTo hand this chat's work to a teammate, start your reply or a line with `@<name>`, as in `@<name>, please check this`; "
      + "a name inside a sentence, or that of a teammate you sent a message to, only mentions it and starts no one.\nTeamRun's command line"));
    Assert.isTrue(note.includes("`acme teamrun list-chats` lists each chat with its teammates and whether a reply is running, "
      + "and `acme teamrun list-teammates` lists every teammate with its provider, model, chats, usage, and its department and manager in each organization."));
    Assert.isFalse(note.includes("teamrun_"));
    Assert.isTrue(note.includes("`acme teamrun list-messages <chatId>` lists a chat's latest messages: `User` is the person, and a message a teammate sent from "
      + "another chat names it and that chat, such as `@<name> in chat \"<title>\" (<chatId>)`, or `the default teammate (<provider>) in chat \"<title>\" (<chatId>)`."));
    Assert.isTrue(note.includes("`acme teamrun send <chatId> - --teammate <name>` sends the text it reads from standard input"));
    Assert.isTrue(note.includes("`acme teamrun send <chatId> - --teammate <name> <<'EOF'`, the text, then `EOF`"));
    Assert.isTrue(note.includes("`$OutputEncoding = [Text.UTF8Encoding]::new($false); @'`, the text, then `'@ | acme teamrun send <chatId> - --teammate <name>`"));
    Assert.isTrue(note.includes("answer it the same way, with `acme teamrun send <chatId> - --teammate <name>`"));
    Assert.isTrue(note.includes(`A message that begins \`${Resources.formatDefaultSenderPrefix("<provider>", "<title>", "<chatId>").trimEnd()}\` comes from that chat's `
      + "default teammate: answer it with `acme teamrun send <chatId> -` and no `--teammate`"));
    Assert.isFalse(note.includes("<text…>"));
    Assert.isFalse(note.includes("teamrun teamrun"));
    Assert.isTrue(note.includes(`\`${Resources.formatSenderPrefix("<name>", "<title>", "<chatId>").trimEnd()}\``));
    Assert.isTrue(note.endsWith("When you tell the person about another chat, name it by its title, never by its id, which is only for the command."));
    Assert.areEqual(`Review carefully\n\n${note}`, Resources.formatTeammateInstructions("Review carefully", "acme teamrun"));
    Assert.areEqual("From @Alice in chat \"Release plan\" (c2): ", Resources.formatSenderPrefix("Alice", "Release plan", "c2"));
    Assert.areEqual("From @Alice in chat c2: ", Resources.formatSenderPrefix("Alice", null, "c2"));
    Assert.areEqual("From the default teammate (Codex) in chat \"Release plan\" (c2): ", Resources.formatDefaultSenderPrefix("Codex", "Release plan", "c2"));
    Assert.areEqual("From the default teammate (Codex) in chat c2: ", Resources.formatDefaultSenderPrefix("Codex", null, "c2"));
    Assert.areEqual("Codex · Work|Codex", [Resources.formatProviderSender("Codex", "Work"), Resources.formatProviderSender("Codex", "Codex")].join("|"));
    Assert.areEqual("From @Alice in chat \"Say \\\"hi\\\"\\nthen go\" (c2): ", Resources.formatSenderPrefix("Alice", "Say \"hi\"\nthen go", "c2"));
    Assert.isTrue(note.includes("A message whose start names teammates after the chat, such as `From @<name> in chat \"<title>\" (<chatId>) to @<other>:`, "
      + "was sent to them, and to you only when it names you, as in `From @<name> in chat \"<title>\" (<chatId>) to you and @<other>:`."));
    Assert.areEqual("From @Alice in chat \"Release plan\" (c2) to @Bob: ", Resources.formatSenderPrefix("Alice", "Release plan", "c2", ["Bob"]));
    Assert.areEqual("From the default teammate (Codex) in chat c2 to @Bob and the default teammate: ",
      Resources.formatDefaultSenderPrefix("Codex", null, "c2", ["Bob", null]));
    Assert.areEqual(" to @Bob, @Carol and the default teammate", Resources.formatRecipients(["Bob", "Carol", null]));
    Assert.areEqual(String.empty, Resources.formatRecipients([]));
    Assert.areEqual(String.empty, Resources.formatRecipients([], true));
    Assert.areEqual(" to you, @Bob and the default teammate", Resources.formatRecipients(["Bob", null], true));
    Assert.areEqual("From the default teammate (Codex) in chat c2 to you and @Bob: ", Resources.formatDefaultSenderPrefix("Codex", null, "c2", ["Bob"], true));
    Assert.areEqual("@Alice hands off to you:\n\n@Bob please review.", Resources.formatHandOff("Alice", "@Bob please review."));
  }

  @TestMethod
  public composesTheFailureLinesFromTheFailuresKindAlone(): void {
    const prompt = "Summarize the plan in secret.md";
    Assert.areEqual("Error ERR_PROVIDER", Resources.formatFailureKind(new CodedError(prompt, "ERR_PROVIDER")));
    Assert.areEqual("TypeError", Resources.formatFailureKind(new TypeError(prompt)));
    Assert.areEqual("Error", Resources.formatFailureKind(new Error(prompt)));
    Assert.areEqual("string", Resources.formatFailureKind(prompt));
    Assert.areEqual("A reply from codex with the provider ending in \"23456789abcd\" ended in an error: Error.",
      Resources.formatReplyFailed("codex", "0192f3a4-5b6c-7d8e-9f01-23456789abcd", "Error"));
    Assert.areEqual("A reply from codex with no provider ended in an error: the provider reported a failed turn.",
      Resources.formatReplyFailed("codex", null, Resources.failedTurnKind));
    Assert.areEqual("The sign-in check of codex for the provider ending in \"23456789abcd\" failed: the provider reported an error.",
      Resources.formatSignInCheckFailed("codex", "0192f3a4-5b6c-7d8e-9f01-23456789abcd", Resources.signInCheckErrorKind));
  }
}
