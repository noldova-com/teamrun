/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { DetailKind, FileChangeSummary, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance,
  ReplyPage, ReplyPanel, ReplyPlan, ReplySummary, RequestedSettings, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";

@TestClass
export class ReplySummaryTests {
  @TestMethod
  public omitsBodiesAndImageDataButKeepsTitlesToolIdentityAndFileCounts(): void {
    const large = "body-content".repeat(10000);
    const message = ReplySummaryTests.message([
      new MessageDetail(0, DetailKind.Text, large, null, "t"),
      new MessageDetail(1, DetailKind.Command, `$ run\n${large}`, { tool: "Bash", toolUseId: "t1", isError: false, output: large, status: "declined", denied: true }, "t"),
      new MessageDetail(2, DetailKind.Note, "Image", { itemType: "imageGeneration", imageData: large }, "t"),
      new MessageDetail(3, DetailKind.FileChange, "Edited a.ts", { changes: [{ path: "a.ts", kind: "update", diff: "@@ h\n-old\n+new\n+again" }] }, "t"),
      new MessageDetail(4, DetailKind.Reasoning, "x".repeat(1000), [1, 2], "t"),
      new MessageDetail(5, DetailKind.Note, "Note", { tool: 3, source: "s".repeat(700) }, "t"),
      new MessageDetail(6, DetailKind.Note, "Plain", null, "t")
    ]);
    const summary = ReplySummary.fromMessage(message);
    const page = new ReplyPage([summary], true, false);
    const restored = ReplyPage.fromJson(page.toJson());
    const json = JSON.stringify(page.toJson());
    Assert.isFalse(json.includes(large));
    Assert.isFalse(json.includes("imageData"));
    Assert.isFalse(json.includes("@@ h"));
    Assert.areEqual(6, summary.preview.details.length);
    Assert.areEqual("$ run", summary.preview.details[0]?.text);
    Assert.areEqual("{\"tool\":\"Bash\",\"toolUseId\":\"t1\",\"isError\":false,\"status\":\"declined\",\"denied\":true}",
      JSON.stringify(summary.preview.details[0]?.payload));
    Assert.areEqual(512, summary.preview.details[3]?.text.length);
    Assert.areEqual(2, summary.files[0]?.additions);
    Assert.areEqual(1, summary.files[0]?.deletions);
    Assert.isTrue(summary.files[0]?.hasDiff ?? false);
    Assert.areEqual(json, JSON.stringify(restored.toJson()));
    Assert.isTrue(restored.hasEarlier);
    Assert.isFalse(restored.hasLater);
    Assert.isTrue(summary.matches(ReplyPanel.Activity));
    Assert.isTrue(summary.matches(ReplyPanel.Changes));
    Assert.areEqual(large, message.details[0]?.text);
  }

  @TestMethod
  @TestData("\u{1F600}")
  @TestData("\u{1F469}\u200D\u{1F4BB}")
  @TestData("\u{1F1EB}\u{1F1F7}")
  @TestData("1\uFE0F\u20E3")
  public endsAPreviewTitleAndPayloadTextBeforeACharacterTheCutWouldSplit(character: string): void {
    const kept = "x".repeat(511);
    const message = ReplySummaryTests.message([new MessageDetail(0, DetailKind.Command, `${kept}${character}`, { source: `${kept}${character}` }, "t")]);

    const detail = ReplySummary.fromMessage(message).preview.details[0];

    Assert.areEqual(kept, detail?.text);
    Assert.areEqual(JSON.stringify({ source: kept }), JSON.stringify(detail?.payload));
  }

  @TestMethod
  public distinguishesActivityFromAnswersImagesWorkingTreeEvidenceAndHandOffNotesAndLines(): void {
    const details = [new MessageDetail(0, DetailKind.Text, "answer", null, "t"), new MessageDetail(1, DetailKind.Error, "error", null, "t"),
      new MessageDetail(2, DetailKind.Note, "image", { itemType: "imageGeneration" }, "t"),
      new MessageDetail(3, DetailKind.FileChange, "report", { source: "workingTree", changes: [{ path: "x", diff: "+a" }] }, "t"),
      new MessageDetail(4, DetailKind.Note, "incomplete", { source: "workingTree" }, "t"),
      new MessageDetail(5, DetailKind.Note, "The chain stopped", { source: "handOff" }, "t"),
      new MessageDetail(6, DetailKind.Note, "Bob handed off to Rita: out of usage", { source: "usageHandOff", handedOff: true }, "t")];
    const summary = ReplySummary.fromMessage(ReplySummaryTests.message(details));
    Assert.isFalse(summary.matches(ReplyPanel.Activity));
    Assert.isTrue(summary.matches(ReplyPanel.Changes));
    Assert.isFalse(ReplySummary.fromMessage(ReplySummaryTests.message([])).matches(ReplyPanel.Changes));
    const unprojected = new ReplySummary(ReplySummaryTests.message([...details.slice(0, 1), new MessageDetail(4, DetailKind.Note, "plain", null, "t")]), []);
    Assert.isTrue(unprojected.matches(ReplyPanel.Activity));
    const note = new ReplySummary(ReplySummaryTests.message([new MessageDetail(5, DetailKind.Note, "array", [], "t")]), []);
    Assert.isTrue(note.matches(ReplyPanel.Activity));
  }

  @TestMethod
  public leavesAReplyWhoseOnlyActivityIsItsPlanOutOfTheActivity(): void {
    const plan = new MessageDetail(1, DetailKind.Plan, "plan", { steps: [{ text: "Read", status: "pending" }] }, "t");
    const listed = (details: readonly MessageDetail[]): boolean => ReplySummary.fromMessage(ReplySummaryTests.message(details)).matches(ReplyPanel.Activity);

    Assert.isFalse(listed([new MessageDetail(0, DetailKind.Text, "answer", null, "t"), plan]));
    Assert.isTrue(listed([plan, new MessageDetail(2, DetailKind.Command, "> ls", null, "t")]));
  }

  @TestMethod
  public keepsASubAgentsOwnStepsOutOfThePreviewButCountsItsFileChanges(): void {
    const agent = new MessageDetail(1, DetailKind.SubAgent, "Find the parser", { toolUseId: "t1", status: "Running", isBackground: true, description: "Find the parser" }, "t");
    const summary = ReplySummary.fromMessage(ReplySummaryTests.message([
      new MessageDetail(0, DetailKind.Text, "answer", null, "t"), agent,
      new MessageDetail(2, DetailKind.Command, "> ls", null, "t", 1),
      new MessageDetail(3, DetailKind.Plan, "plan", { steps: [], explanation: null, text: "# Its own plan" }, "t", 1),
      new MessageDetail(4, DetailKind.FileChange, "Edited a.ts", { changes: [{ path: "a.ts", kind: "update", diff: "+a" }] }, "t", 1)]));

    Assert.areEqual(`1|null|${JSON.stringify(agent.payload)}`,
      `${summary.preview.details.map(t => t.sequence).join()}|${summary.preview.details[0]?.parentSequence}|${JSON.stringify(summary.preview.details[0]?.payload)}`);
    Assert.isTrue(summary.matches(ReplyPanel.Activity));
    Assert.isFalse(summary.matches(ReplyPanel.Plan));
    Assert.isTrue(summary.matches(ReplyPanel.SubAgents));
    Assert.areEqual(1, summary.files.length);
  }

  @TestMethod
  public listsAReplyInThePlanPanelOnlyWhenItHasAPlanAndKeepsThePlanWhole(): void {
    const text = `# Move the cache\n${"Step. ".repeat(200)}`;
    const plan = new MessageDetail(1, DetailKind.Plan, "Move the cache", { steps: [], explanation: null, text }, "t");
    const summary = (details: readonly MessageDetail[]): ReplySummary => ReplySummary.fromMessage(ReplySummaryTests.message(details));

    Assert.isTrue(summary([new MessageDetail(0, DetailKind.Text, "answer", null, "t"), plan]).matches(ReplyPanel.Plan));
    Assert.areEqual(text.trim(), ReplyPlan.ofDetails(summary([plan]).preview.details)?.text);
    Assert.isFalse(summary([new MessageDetail(0, DetailKind.Command, "> ls", null, "t")]).matches(ReplyPanel.Plan));
    Assert.isFalse(summary([new MessageDetail(1, DetailKind.Plan, "plan", { steps: [], explanation: null }, "t")]).matches(ReplyPanel.Plan));
  }

  @TestMethod
  public listsAReplyInTheSubAgentsPanelOnlyWhenItStartedASubAgentItselfAndKeepsTheSubAgentWhole(): void {
    const payload = new SubAgent("t1", "Explore", "Find the parser", "haiku", SubAgentStatus.Completed, false, 14, 38200, 72000, `${"Found it. ".repeat(200)}`).toJson();
    const agent = new MessageDetail(1, DetailKind.SubAgent, "Find the parser", payload, "t");
    const summary = (details: readonly MessageDetail[]): ReplySummary => ReplySummary.fromMessage(ReplySummaryTests.message(details));

    Assert.isTrue(summary([new MessageDetail(0, DetailKind.Text, "answer", null, "t"), agent]).matches(ReplyPanel.SubAgents));
    Assert.areEqual(JSON.stringify(payload), JSON.stringify(summary([agent]).preview.details[0]?.payload));
    Assert.isFalse(summary([new MessageDetail(0, DetailKind.Command, "> ls", null, "t")]).matches(ReplyPanel.SubAgents));
    Assert.isFalse(summary([new MessageDetail(0, DetailKind.Command, "> ls", null, "t"),
      new MessageDetail(1, DetailKind.Command, "> ls", null, "t"), new MessageDetail(2, DetailKind.SubAgent, "Nested", payload, "t", 1)]).matches(ReplyPanel.SubAgents));
  }

  @TestMethod
  public leavesACancelledReplysStoredCancelNoteOutOfTheActivity(): void {
    const note = (text: string): MessageDetail => new MessageDetail(1, DetailKind.Note, text, null, "t");
    const listed = (status: MessageStatus, details: readonly MessageDetail[]): boolean =>
      ReplySummary.fromMessage(ReplySummaryTests.message(details).withStatus(status, "t2")).matches(ReplyPanel.Activity);

    Assert.isFalse(listed(MessageStatus.Cancelled, [note("The reply was cancelled.")]));
    Assert.isFalse(listed(MessageStatus.Cancelled, [new MessageDetail(0, DetailKind.Text, "partial", null, "t"), note("Cancelled before this participant started.")]));
    Assert.isTrue(listed(MessageStatus.Cancelled, [new MessageDetail(0, DetailKind.Command, "> ls", null, "t"), note("The reply was cancelled.")]));
    Assert.isTrue(listed(MessageStatus.Completed, [note("The reply was cancelled.")]));
  }

  @TestMethod
  public listsAReplyWhoseCommandsRanOutsideTheChatsFolderInTheChangesAndCarriesWhetherTheChatRanACommand(): void {
    const outside = new MessageDetail(1, DetailKind.Note, "Commands ran in /tmp", { source: "workingTree", changesNote: true, folders: ["/tmp"] }, "t");
    const summary = ReplySummary.fromMessage(ReplySummaryTests.message([new MessageDetail(0, DetailKind.Command, "ls", { cwd: "/tmp" }, "t"), outside]));
    const other = ReplySummary.fromMessage(ReplySummaryTests.message([new MessageDetail(1, DetailKind.Note, "Commands ran", { changesNote: "yes" }, "t"),
      new MessageDetail(2, DetailKind.Note, "plain", null, "t")]));

    Assert.areEqual("{\"source\":\"workingTree\",\"changesNote\":true}", JSON.stringify(summary.preview.details[1]?.payload));
    Assert.isTrue(summary.matches(ReplyPanel.Changes));
    Assert.isFalse(ReplySummary.fromMessage(ReplySummaryTests.message([outside])).matches(ReplyPanel.Activity));
    Assert.isFalse(other.matches(ReplyPanel.Changes));
    Assert.areEqual("true,false", [new ReplyPage([summary], false, false, true), new ReplyPage([], false, false)]
      .map(t => ReplyPage.fromJson(t.toJson()).ranCommands).join(","));
    Assert.isFalse(ReplyPage.fromJson({ replies: [], hasEarlier: false, hasLater: false }).ranCommands);
    Assert.throws(() => ReplyPage.fromJson({ replies: [], hasEarlier: false, hasLater: false, ranCommands: "yes" }), JsonException);
  }

  @TestMethod
  public rejectsInvalidWireFieldsAndCounts(): void {
    Assert.throws(() => new FileChangeSummary(" ", "update", 0, 0, false), ArgumentException);
    Assert.throws(() => new FileChangeSummary("a", "update", -1, 0, true), ArgumentOutOfRangeException);
    Assert.throws(() => new FileChangeSummary("a", "update", 0, 1.5, true), ArgumentOutOfRangeException);
    const value = new FileChangeSummary("a", "add", 1, 0, true).toJson();
    Assert.throws(() => FileChangeSummary.fromJson({ ...value, hasDiff: "yes" }), JsonException);
    Assert.throws(() => ReplySummary.fromJson({ preview: {}, files: [] }), JsonException);
    Assert.throws(() => ReplyPage.fromJson({ replies: [], hasEarlier: false }), JsonException);
  }

  private static message(details: readonly MessageDetail[]): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    return new Message("r1", "c1", 1, MessageAuthor.Provider, null, MessageStatus.Completed, details, provenance, "t", "t", "t2");
  }
}
