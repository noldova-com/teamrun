/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  AuthStatus,
  DetailKind,
  FileChangeSummary,
  Harness,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  ObservedSettings,
  PermissionPayload,
  PermissionRisk,
  PlanStep,
  PlanStepStatus,
  Provenance,
  Provider,
  ProviderKind,
  ProviderModel,
  ReplyPlan,
  RequestedSettings,
  SubAgent,
  SubAgentStatus,
  Teammate
} from "@noldova/teamrun.protocol";
import { ToolCall, ToolCallKind, ToolCallOutputState, ToolCallStatus } from "@noldova/ui.components.angular";

import { SampleData } from "../../fixtures/sample-data.fixture";
import { SamplePages } from "../../fixtures/sample-pages.fixture";
import { ReplyActivity } from "../../../src/app/enums/reply-activity";
import { SegmentKind } from "../../../src/app/enums/segment-kind";
import { StepCategory } from "../../../src/app/enums/step-category";
import { ActivityEntry } from "../../../src/app/models/activity-entry";
import { ChatThread } from "../../../src/app/models/chat-thread";
import { ModelCatalog } from "../../../src/app/models/model-catalog";
import { SustainHandover } from "../../../src/app/models/sustain-handover";
import { Resources } from "../../../src/resources";
import { FormatterService } from "../../../src/app/services/formatter.service";

describe("FormatterService", () => {
  const formatter = (): FormatterService => TestBed.inject(FormatterService);
  const detail = (sequence: number, kind: DetailKind, text: string, payload: JsonValue = null): MessageDetail =>
    new MessageDetail(sequence, kind, text, payload, SampleData.timestamp);
  const reply = (details: readonly MessageDetail[], status: MessageStatus = MessageStatus.Completed): Message =>
    SampleData.withStatus(SampleData.reply, status, details);
  const kind = (provenance: Provenance, teammateId: string | null = null, teammateName: string | null = null): Message =>
    new Message("m3", "c1", 2, MessageAuthor.Provider, null, MessageStatus.Completed, [], provenance, SampleData.timestamp, null, SampleData.timestamp, [],
      teammateId, teammateName);

  it("sorts steps into commands, edits, reads, searches, thoughts and other steps, the order a summary counts them in", () => {
    expect(Object.values(StepCategory)).toEqual(["Command", "Edit", "Read", "Search", "Thought", "Other"]);
  });

  it.each([
    { state: "equals the reply's plan text but for its outer whitespace", text: "\n# Tidy the cache\n\n1. Drop stale entries.  ", shown: ["Plan:1"] },
    { state: "differs from the reply's plan text", text: "# Tidy the cache\n\n1. Drop the stale entries.", shown: ["Text:0", "Plan:1"] }
  ])("shows a reply's answer that $state only as the plan card when it does, and as its text otherwise", ({ text, shown }) => {
    const message = reply([detail(0, DetailKind.Text, text),
      detail(1, DetailKind.Plan, "Tidy the cache", new ReplyPlan([], null, "# Tidy the cache\n\n1. Drop stale entries.").toJson())]);

    expect(formatter().segments(message).map(t => `${t.kind}:${t.key}`)).toEqual(shown);
  });

  it("names authors and providers", () => {
    const kinds = [SampleData.codex, SampleData.claude];
    const providers = [SampleData.provider];
    const requestedOnly = new Provenance(null, new RequestedSettings("claude", null, null), new ObservedSettings(null, null, null, null), null, false);

    expect(formatter().authorLabel(SampleData.userMessage, kinds, providers)).toBe(Resources.youLabel);
    expect(formatter().authorLabel(SampleData.reply, kinds, providers)).toBe("Codex · Work");
    expect(formatter().authorLabel(kind(requestedOnly), kinds, providers)).toBe("Claude Code");
    expect(formatter().authorLabel(kind(SampleData.provenance, "t1", "Reviewer"), kinds, providers)).toBe("Reviewer");
    expect(formatter().authorLabel(new Message("m3", "c1", 2, MessageAuthor.TeamRun, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp), kinds, providers)).toBe(Resources.teamRunLabel);
    expect(formatter().providerName("other", kinds)).toBe("other");
    expect([formatter().replyProvider(kind(SampleData.provenance, "t1", "Reviewer"), kinds), formatter().replyProvider(kind(requestedOnly, "t1", "Reviewer"), kinds),
      formatter().replyProvider(SampleData.reply, kinds), formatter().replyProvider(SampleData.userMessage, kinds)]).toEqual(["Codex", "Claude Code", null, null]);
    expect([formatter().replyProvider(kind(SampleData.provenance, "t1", "Reviewer"), []),
      formatter().replyProvider(kind(SampleData.provenance, "t1", "Reviewer"), [SampleData.claude])]).toEqual([null, null]);
  });

  it("names a default teammate's reply by its provider, the kind alone for a provider named after it, and the kind alone once the provider is gone", () => {
    const kinds = [SampleData.codex, SampleData.claude];
    const personal = new Provider("a3", "codex", "Personal", "/profiles/personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const named = new Provider("a4", "codex", "Codex", "/profiles/named", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const providers = [SampleData.provider, personal, named];
    const on = (providerId: string | null): Message => kind(new Provenance(providerId, SampleData.provenance.requested, SampleData.provenance.observed, "s1", false));
    const label = (message: Message, listed: readonly Provider[] = providers): string => formatter().authorLabel(message, kinds, listed);

    expect([label(on("a1")), label(on("a3")), label(on("a4"))]).toEqual(["Codex · Work", "Codex · Personal", "Codex"]);
    expect([label(on("gone")), label(on(null)), label(on("a3"), [SampleData.provider])]).toEqual(["Codex", "Codex", "Codex"]);
    expect(formatter().replyAuthor(on("a3"), kinds, providers, false).name).toBe("Codex · Personal");
  });

  it("splits a reply into answer and activity, joining tool results to their steps", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Session tools: Read"),
      detail(1, DetailKind.Note, "Read: D:\\repo\\README.md", { tool: "Read", toolUseId: "t1" }),
      detail(2, DetailKind.Note, "# Demo", { toolUseId: "t1", isError: false }),
      detail(3, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash", toolUseId: "t2" }),
      detail(4, DetailKind.Note, "boom", { toolUseId: "t2", isError: true }),
      detail(5, DetailKind.Note, "unrelated", { toolUseId: "t9" }),
      detail(6, DetailKind.Text, "Done."),
      detail(7, DetailKind.Error, "failed")
    ]);

    const activity = formatter().activity(message);
    const answers = formatter().answers(message);

    expect(answers.map(t => t.sequence)).toEqual([6, 7]);
    expect(activity.map(t => t.detail.sequence)).toEqual([0, 1, 3, 5]);
    expect(activity.map(t => t.result?.sequence ?? null)).toEqual([null, 2, 4, null]);
    expect(activity.map(t => t.result).filter(t => t !== null).map(t => formatter().isErrorResult(t))).toEqual([false, true]);
    expect(activity.map(t => formatter().toolName(t.detail))).toEqual([null, "Read", "Bash", null]);
    expect(activity.map(t => formatter().title(t.detail, "D:\\repo"))).toEqual(["Session tools: Read", "Read: .\\README.md", "> ls", "unrelated"]);
    expect(activity.map(t => formatter().body(t.detail))).toEqual([null, null, "file.txt", null]);
    expect(formatter().title(detail(9, DetailKind.Note, "D:\\repo\\a"), " ")).toBe("D:\\repo\\a");
  });

  it("pairs a result with an earlier open step of its tool call, and keeps a step apart when it cannot be a result", () => {
    const activity = formatter().activity(reply([
      detail(0, DetailKind.Note, "Read: a", { tool: "Read", toolUseId: "t1" }),
      detail(1, DetailKind.Note, "plain"),
      detail(2, DetailKind.Note, "# a", { toolUseId: "t1" }),
      detail(3, DetailKind.Note, "again", { toolUseId: "t1" }),
      detail(4, DetailKind.Note, "odd", { toolUseId: 5 }),
      detail(5, DetailKind.Note, "unnamed", { tool: 7 }),
      detail(6, DetailKind.Note, "listed", ["tool"])
    ]));

    expect(activity.map(t => [t.detail.sequence, t.result?.sequence ?? null])).toEqual([[0, 2], [1, null], [3, null], [4, null], [5, null], [6, null]]);
    expect(activity.map(t => formatter().toolName(t.detail))).toEqual(["Read", null, null, null, null, null]);
    expect(formatter().isErrorResult(detail(6, DetailKind.Note, "x"))).toBe(false);
  });

  it("splits a reply into segments in order and summarises a run of steps, leaving out text between them", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Session tools: Read"),
      detail(1, DetailKind.Note, "Read: D:\\repo\\README.md", { tool: "Read", toolUseId: "t1" }),
      detail(2, DetailKind.Note, "# Demo", { toolUseId: "t1", isError: false }),
      detail(3, DetailKind.Text, "Looking."),
      detail(4, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t2" }),
      detail(5, DetailKind.FileChange, "Edit: a.ts", { tool: "Edit", toolUseId: "t3", input: { file_path: "a.ts", old_string: "a", new_string: "b" } }),
      detail(6, DetailKind.Note, "Generated image (completed): out.png", { itemType: "imageGeneration", savedPath: "out.png", mediaType: "image/png" }),
      detail(7, DetailKind.Reasoning, "hmm"),
      detail(8, DetailKind.Note, "Glob: *.ts", { tool: "Glob", toolUseId: "t4" }),
      detail(9, DetailKind.Text, "Done."),
      detail(10, DetailKind.FileChange, "Files changed in the working tree: a.ts", { files: ["/repo/a.ts"], source: "workingTree", changes: [] }),
      detail(11, DetailKind.Note, "Git evidence may omit changes.", { source: "workingTree" })
    ]);

    const segments = formatter().segments(message);

    expect(segments.map(t => `${t.kind}:${t.key}:${t.entries.length}`))
      .toEqual(["Activity:0:2", "Text:3:0", "Activity:4:2", "Image:6:0", "Activity:7:2", "Text:9:0"]);
    expect(formatter().activity(message).map(t => t.detail.sequence)).toEqual([0, 1, 4, 5, 7, 8]);
    expect(segments.map(t => formatter().activitySummary(t.entries))).toEqual(["Read 1 file, 1 more step", "", "Ran 1 command, edited 1 file", "", "Searched once, thought once", ""]);
    expect(formatter().activitySummary(formatter().activity(reply([detail(0, DetailKind.Note, "a"), detail(1, DetailKind.Note, "b")])))).toBe("2 steps");
    expect(formatter().activitySummary(formatter().activity(reply([detail(0, DetailKind.Note, "a")])))).toBe("1 step");
    const commands = reply([detail(0, DetailKind.Command, "> a"), detail(1, DetailKind.Command, "> b"), detail(2, DetailKind.Note, "c"), detail(3, DetailKind.Note, "d")]);
    expect(formatter().activitySummary(formatter().activity(commands))).toBe("Ran 2 commands, 2 more steps");
    const many = reply([0, 1].flatMap(t => [
      detail(t * 3, DetailKind.Note, "Read: a", { tool: "Read" }), detail(t * 3 + 1, DetailKind.Note, "Grep: a", { tool: "Grep" }), detail(t * 3 + 2, DetailKind.Note, "Bash", { tool: "PowerShell" })
    ]));
    expect(formatter().activitySummary(formatter().activity(many))).toBe("Ran 2 commands, read 2 files, searched 2 times");
    expect(formatter().activitySummary([...formatter().activity(commands).slice(0, 2), new ActivityEntry(detail(4, DetailKind.Text, "Then the rest."), null)]))
      .toBe("Ran 2 commands");
    expect(message.details.map(t => formatter().isGeneratedImage(t))).toEqual([false, false, false, false, false, false, true, false, false, false, false, false]);
    expect(message.details.map(t => formatter().isWorkingTreeEvidence(t))).toEqual([false, false, false, false, false, false, false, false, false, false, true, true]);
  });

  it("shows a generated image from TeamRun's stored copy, else from where it was saved in the project, else from its own bytes, else not at all", () => {
    const generated = (sequence: number, payload: JsonValue): MessageDetail => detail(sequence, DetailKind.Note, "Generated image (completed)", payload);
    const message = reply([
      generated(0, { itemType: "imageGeneration", savedPath: "C:\\Users\\me\\.codex\\generated_images\\sun.png", storedPath: "D:\\data\\images\\m4-0.png",
        imageData: null, mediaType: "image/png" }),
      generated(1, { itemType: "imageGeneration", savedPath: "D:\\repo\\out\\moon.png", storedPath: "D:\\data\\images\\m4-1.jpg", imageData: null, mediaType: "image/jpeg" }),
      generated(2, { itemType: "imageGeneration", savedPath: null, storedPath: "D:\\data\\images\\m4-2.webp", imageData: null, mediaType: "image/webp" }),
      generated(3, { itemType: "imageGeneration", savedPath: "D:\\repo\\out\\moon.png", imageData: "iVBORw==", mediaType: "image/png" }),
      generated(4, { itemType: "imageGeneration", savedPath: "C:\\Users\\me\\sun.png", imageData: "iVBORw==", mediaType: "image/png" }),
      generated(5, { itemType: "imageGeneration", savedPath: null, imageData: "UklGRg==", mediaType: "image/webp" }),
      generated(6, { itemType: "imageGeneration", savedPath: "C:\\Users\\me\\sun.png", imageData: "iVBORw==", mediaType: null }),
      generated(7, { itemType: "imageGeneration", savedPath: "C:\\Users\\me\\sun.png", imageData: null, mediaType: null })
    ]);
    const viewed = (rootPath: string | null): (readonly unknown[] | null)[] => message.details.map(t => {
      const image = formatter().generatedImageOf(message, t, rootPath);
      return image === null ? null : [image.key, image.conversationId, image.name, image.mediaType, image.path, image.data, image.messageId];
    });

    expect(viewed("D:\\repo")).toEqual([
      [`${message.id}:D:\\data\\images\\m4-0.png`, "c1", "sun.png", "image/png", "D:\\data\\images\\m4-0.png", null, message.id],
      [`${message.id}:D:\\data\\images\\m4-1.jpg`, "c1", "moon.png", "image/jpeg", "D:\\data\\images\\m4-1.jpg", null, message.id],
      [`${message.id}:D:\\data\\images\\m4-2.webp`, "c1", "Generated image", "image/webp", "D:\\data\\images\\m4-2.webp", null, message.id],
      [`${message.id}:D:\\repo\\out\\moon.png`, "c1", "moon.png", "image/png", "D:\\repo\\out\\moon.png", null, message.id],
      [`${message.id}:4`, "c1", "sun.png", "image/png", null, "iVBORw==", null],
      [`${message.id}:5`, "c1", "Generated image", "image/webp", null, "UklGRg==", null],
      null,
      null
    ]);
    expect(viewed(null)[3]).toEqual([`${message.id}:3`, "c1", "moon.png", "image/png", null, "iVBORw==", null]);
  });

  it("says a generated image failed, with the usage limit as its reason, and that a finished one it can't read couldn't be shown, but nothing while it runs", () => {
    const generated = (sequence: number, payload: JsonValue): MessageDetail => detail(sequence, DetailKind.Note, "Generated image: not saved", payload);
    const message = reply([
      generated(0, { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: null, mediaType: null,
        failure: { type: "usageLimitExceeded", limitId: "images", resetsAt: 1761500000 } }),
      generated(1, { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: null, mediaType: null, failure: null }),
      generated(2, { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: null, mediaType: null }),
      generated(3, { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: null, mediaType: null, failure: { type: "unknown" } }),
      generated(4, { itemType: "imageGeneration", status: "failed", savedPath: null, imageData: "iVBORw==", mediaType: "image/png", failure: "refused" }),
      generated(5, { itemType: "imageGeneration", status: "completed", savedPath: null, imageData: null, mediaType: null }),
      generated(6, { itemType: "imageGeneration", status: "completed", savedPath: null, imageData: "iVBORw==", mediaType: "image/png" }),
      generated(7, { itemType: "imageGeneration", status: "inProgress", savedPath: null, imageData: null, mediaType: null }),
      generated(8, { itemType: "imageGeneration", savedPath: null, imageData: null, mediaType: null })
    ]);

    expect(message.details.map(t => formatter().missingImageOf(message, t, "D:\\repo")).map(t => t === null ? null : [t.text, t.reason])).toEqual([
      [Resources.imageGenerationFailed, Resources.imageLimitReached],
      [Resources.imageGenerationFailed, null],
      [Resources.imageGenerationFailed, null],
      [Resources.imageGenerationFailed, null],
      [Resources.imageGenerationFailed, null],
      [Resources.imageNotShown, null],
      null,
      null,
      null
    ]);
    expect(formatter().generatedImageOf(message, message.details[4]!, "D:\\repo")).toBeNull();
  });

  it("gives a failed image the message its failure carries as the reason, as Grok's raw output does, and none for a blank or non-text message", () => {
    const failed = (sequence: number, failure: JsonValue): MessageDetail => detail(sequence, DetailKind.Note, "Generated image: not saved",
      { itemType: "imageGeneration", status: "failed", savedPath: null, revisedPrompt: null, failure, imageData: null, mediaType: null });
    const message = reply([
      failed(0, { error: "tool_execution_failed", message: "  Image generation failed with HTTP 422 Unprocessable Entity\n" }),
      failed(1, { message: "Refused." }),
      failed(2, { error: "tool_execution_failed", message: " \n " }),
      failed(3, { error: "tool_execution_failed", message: 422 }),
      failed(4, { error: "tool_execution_failed" }),
      failed(5, {}),
      failed(6, { type: "usageLimitExceeded", message: "Limit reached" })
    ]);

    expect(message.details.map(t => formatter().missingImageOf(message, t, null)?.reason)).toEqual([
      "Image generation failed with HTTP 422 Unprocessable Entity", "Refused.", null, null, null, null, Resources.imageLimitReached
    ]);
  });

  it("keys a generated image saved in the project by its step while the reply runs, so a later step that rewrites it is read again, and by its path once the reply ends", () => {
    const generated = (sequence: number): MessageDetail => detail(sequence, DetailKind.Note, "Generated image (completed)",
      { itemType: "imageGeneration", savedPath: "D:\\repo\\out\\moon.png", imageData: "iVBORw==", mediaType: "image/png" });
    const keys = (status: MessageStatus): string[] => {
      const message = reply([generated(0), detail(1, DetailKind.Command, "> magick out/moon.png -resize 50% out/moon.png"), generated(2)], status);
      return [0, 2].map(t => formatter().generatedImageOf(message, message.details[t]!, "D:\\repo")!.key);
    };
    const id = reply([]).id;

    expect(keys(MessageStatus.Running)).toEqual([`${id}:0:D:\\repo\\out\\moon.png`, `${id}:2:D:\\repo\\out\\moon.png`]);
    expect(keys(MessageStatus.AwaitingApproval)[1]).toBe(`${id}:2:D:\\repo\\out\\moon.png`);
    expect(keys(MessageStatus.Completed)).toEqual([`${id}:D:\\repo\\out\\moon.png`, `${id}:D:\\repo\\out\\moon.png`]);
    expect(keys(MessageStatus.Failed)[0]).toBe(`${id}:D:\\repo\\out\\moon.png`);
  });

  it("keeps the note that a teammate hand-off chain stopped out of the activity, as a text segment of its own after the answer", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Read: a.ts", { tool: "Read", toolUseId: "t1" }),
      detail(1, DetailKind.Text, "@Bob yours"),
      detail(2, DetailKind.Note, "The chain stopped after 4 hand-offs. You can change this limit in Settings › TeamRun. Mention a teammate to go on.", { source: "handOff" })
    ]);

    expect(formatter().segments(message).map(t => `${t.kind}:${t.key}:${t.entries.length}`)).toEqual(["Activity:0:1", "Text:1:0", "Text:2:0"]);
    expect(formatter().activity(message).map(t => t.detail.sequence)).toEqual([0]);
    expect(message.details.map(t => formatter().isHandOffNote(t))).toEqual([false, false, true]);
    expect(formatter().isHandOffNote(detail(3, DetailKind.Note, "Git evidence may omit changes.", { source: "workingTree" }))).toBe(false);
    expect(formatter().answers(message).map(t => t.sequence)).toEqual([1]);
  });

  it("finds the line that ends a reply at a usage limit, and whether it handed off, in a reply only", () => {
    const handed = detail(0, DetailKind.Note, "Bob handed off to Rita: out of usage", { source: "usageHandOff", handedOff: true });
    const stopped = detail(0, DetailKind.Note, "Bob is out of usage.", { source: "usageHandOff", handedOff: false });
    const sent = new Message("u1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, [handed], null, SampleData.timestamp, null, SampleData.timestamp);

    expect([reply([handed]), reply([stopped]), reply([detail(0, DetailKind.Note, "The chain stopped", { source: "handOff" })]), sent].map(t => FormatterService.usageHandOffOf(t)))
      .toEqual([handed, stopped, null, null]);
    expect([handed, stopped, detail(0, DetailKind.Note, "plain")].map(t => FormatterService.handsOff(t))).toEqual([true, false, false]);
  });

  it("tells a Sustain note that stops its chain from one that moves it", () => {
    const moved = detail(0, DetailKind.Note, "Moved to Codex, Spare because Work reached its usage limit; new session with a handover", { source: "sustain" });
    const stopped = detail(1, DetailKind.Note, "No Sustain entry is left: Codex · Work resets at 18:00.", { source: "sustain", stopped: true });

    expect([moved, stopped, detail(2, DetailKind.Note, "plain")].map(t => FormatterService.stopsSustain(t))).toEqual([false, true, false]);
  });

  it("reads what a Sustain note's handover carried, and none from a note without it or with nothing carried", () => {
    const kept = detail(0, DetailKind.Note, "Moved", { source: "sustain", handover: "The chat so far", carried: ["Messages 1 to 4 whole", 3], reads: "Codex reads what was left out" });
    const quiet = detail(1, DetailKind.Note, "Moved", { source: "sustain", handover: "The chat so far", carried: ["Messages 1 to 4 whole"], reads: 3 });
    const empty = detail(2, DetailKind.Note, "Moved", { source: "sustain", handover: "The chat so far", carried: [] });
    const odd = detail(3, DetailKind.Note, "Moved", { source: "sustain", carried: "Messages 1 to 4 whole" });

    expect([kept, quiet, empty, odd, detail(4, DetailKind.Note, "Moved back", { source: "sustain" }), detail(5, DetailKind.Note, "plain")].map(t => FormatterService.handoverOf(t)))
      .toEqual([new SustainHandover(["Messages 1 to 4 whole"], "Codex reads what was left out"), new SustainHandover(["Messages 1 to 4 whole"], null), null, null, null, null]);
  });

  it("combines consecutive thoughts into one thinking step and keeps the steps between them apart", () => {
    const message = reply([
      detail(0, DetailKind.Reasoning, "Reading the files first. Then more."),
      detail(1, DetailKind.Reasoning, "Comparing them."),
      detail(2, DetailKind.Command, "> ls"),
      detail(3, DetailKind.Reasoning, "One more idea"),
      detail(4, DetailKind.Text, "Done."),
      detail(5, DetailKind.Reasoning, "After the answer.")
    ]);

    const activity = formatter().activity(message);

    expect(activity.map(t => [t.detail.sequence, t.detail.kind, t.detail.text])).toEqual([
      [0, DetailKind.Reasoning, "Reading the files first. Then more.\n\nComparing them."],
      [2, DetailKind.Command, "> ls"],
      [3, DetailKind.Reasoning, "One more idea"],
      [5, DetailKind.Reasoning, "After the answer."]
    ]);
    expect(formatter().activitySummary(activity.slice(0, 3))).toBe("Ran 1 command, thought 2 times");
    expect(formatter().title(activity[0]?.detail ?? detail(9, DetailKind.Text, "missing"))).toBe("Reading the files first.");
    expect(activity.map(t => formatter().body(t.detail))).toEqual(["Then more.\n\nComparing them.", null, null, null]);
    expect(formatter().title(detail(9, DetailKind.Reasoning, "First line\nsecond line."))).toBe("First line");
  });

  it("names added, edited and deleted files apart, a moved or unknown kind among the edited, and labels each file by its kind", () => {
    expect([[], ["add", "add"], ["update"], ["delete", "move", "add", "update"], ["delete"]].map(t => formatter().fileChangeParts(t)))
      .toEqual([[], ["added 2 files"], ["edited 1 file"], ["added 1 file", "edited 2 files", "deleted 1 file"], ["deleted 1 file"]]);
    expect(["add", "delete", "update", "move", "rename"].map(t => formatter().fileChangeLabel(t))).toEqual(["Added", "Deleted", "Edited", "Edited", "Edited"]);
  });

  it("counts the distinct files that the replies' changes read as added, edited or deleted, like the Changes panel", () => {
    const edit = (sequence: number, path: string): MessageDetail =>
      detail(sequence, DetailKind.FileChange, `Edit: ${path}`, { tool: "Edit", toolUseId: `t${sequence}`, input: { file_path: path, old_string: "a", new_string: "b" } });
    const activity = formatter().activity(reply([
      edit(0, "a.ts"),
      edit(1, "a.ts"),
      detail(2, DetailKind.FileChange, "Edit", { changes: [{ path: "b.ts", kind: "add", diff: "+b" }] }),
      detail(3, DetailKind.FileChange, "Edit: unreadable", { tool: "edit" }),
      detail(4, DetailKind.Command, "> ls")
    ]));

    expect(formatter().activitySummary(activity)).toBe("Ran 1 command, added 1 file, edited 1 file");
    expect(formatter().activitySummary(activity, ["add", "update", "move", "delete", "delete"].map((t, i) => new FileChangeSummary(`${i}.ts`, t, 0, 0, false))))
      .toBe("Ran 1 command, added 1 file, edited 2 files, deleted 2 files");
    expect(formatter().activitySummary(activity.slice(3))).toBe("Ran 1 command");
  });

  it("turns each step into the kit's tool call, with its kind, its status and its output, or no output to load when it has none", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Session tools: Read"),
      detail(1, DetailKind.Note, "Read: D:\\repo\\README.md", { tool: "Read", toolUseId: "t1" }),
      detail(2, DetailKind.Note, "# Demo", { toolUseId: "t1" }),
      detail(3, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash", toolUseId: "t2" }),
      detail(4, DetailKind.Note, "boom", { toolUseId: "t2", isError: true }),
      detail(5, DetailKind.FileChange, "Edit: a.ts"),
      detail(6, DetailKind.Note, "WebFetch: x", { tool: "WebFetch" }),
      detail(7, DetailKind.Reasoning, "Planning. The steps."),
      detail(8, DetailKind.Note, "  "),
      detail(9, DetailKind.Error, "denied")
    ]);
    const activity = formatter().activity(message);
    const calls = formatter().callsOf(message, activity, "D:\\repo");

    expect(calls.map(t => [t.id, t.title, t.kind, t.status, t.output, t.outputState])).toEqual([
      ["0", "Session tools: Read", ToolCallKind.Other, ToolCallStatus.Succeeded, null, ToolCallOutputState.None],
      ["1", "Read: .\\README.md", ToolCallKind.Read, ToolCallStatus.Succeeded, "# Demo", ToolCallOutputState.Idle],
      ["3", "> ls", ToolCallKind.RunCommand, ToolCallStatus.Failed, "file.txt\nboom", ToolCallOutputState.Idle],
      ["5", "Edit: a.ts", ToolCallKind.Edit, ToolCallStatus.Succeeded, null, ToolCallOutputState.None],
      ["6", "WebFetch: x", ToolCallKind.Search, ToolCallStatus.Succeeded, null, ToolCallOutputState.None],
      ["7", "Planning.", ToolCallKind.Other, ToolCallStatus.Succeeded, "The steps.", ToolCallOutputState.Idle],
      ["8", Resources.stepLabel, ToolCallKind.Other, ToolCallStatus.Succeeded, null, ToolCallOutputState.None]
    ]);
    expect(formatter().callOf(new ActivityEntry(detail(9, DetailKind.Error, "denied"), null), true, null).status).toBe(ToolCallStatus.Failed);
    expect(formatter().bodyOf(new ActivityEntry(detail(9, DetailKind.Command, "> a\nout"), null))).toBe("out");
  });

  it("counts and shows ACP read, search and fetch steps, and Codex web searches, as reads and searches", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Read a.ts", { toolCallId: "c1", tool: "read", status: "completed" }),
      detail(1, DetailKind.Note, "Search for png", { toolCallId: "c2", tool: "search", status: "completed" }),
      detail(2, DetailKind.Note, "Fetch https://example.com", { toolCallId: "c3", tool: "fetch", status: "completed" }),
      detail(3, DetailKind.Note, "Web search: cats", { tool: "webSearch", readOnly: true })
    ]);
    const activity = formatter().activity(message);

    expect(formatter().activitySummary(activity)).toBe("Read 1 file, searched 3 times");
    expect(formatter().callsOf(message, activity, null).map(t => t.kind))
      .toEqual([ToolCallKind.Read, ToolCallKind.Search, ToolCallKind.Search, ToolCallKind.Search]);
    expect(activity.map(t => formatter().stepOf(t, null).glyph)).toEqual(["description", "search", "search", "search"]);
  });

  it("counts a Codex MCP or dynamic tool named read or search as another step, and only an ACP step by its kind", () => {
    const categoryOf = (shown: MessageDetail): StepCategory => formatter().stepOf(new ActivityEntry(shown, null), null).category;

    expect([
      categoryOf(detail(0, DetailKind.Note, "MCP tool docs/read (completed)", { server: "docs", tool: "read", status: "completed" })),
      categoryOf(detail(1, DetailKind.Note, "Tool search (completed)", { tool: "search", status: "completed" })),
      categoryOf(detail(2, DetailKind.Note, "Tool fetch (completed)", { tool: "fetch", status: "completed" })),
      categoryOf(detail(3, DetailKind.Note, "Read a.ts", { toolCallId: "c1", tool: "read", status: "completed" })),
      categoryOf(detail(4, DetailKind.Note, "Read: a.ts", { tool: "Read", toolUseId: "tu-1" })),
      categoryOf(detail(5, DetailKind.Note, "Read a.ts", { toolCallId: 1, tool: "read" }))
    ]).toEqual([StepCategory.Other, StepCategory.Other, StepCategory.Other, StepCategory.Read, StepCategory.Read, StepCategory.Other]);
  });

  it("titles a command with the title its provider or its shell's rules gave it, and shows the exact command and its output in its body", () => {
    const codex = detail(0, DetailKind.Command, "$ rg -n foo D:\\repo\\src\n/bin/bash -lc 'rg -n foo D:\\repo\\src'\nsrc/a.ts:1:foo",
      { command: "/bin/bash -lc 'rg -n foo D:\\repo\\src'", status: "completed", exitCode: 0, title: "Searched for foo in D:\\repo\\src" });
    const claude = detail(1, DetailKind.Command, "Bash: ls -la", { tool: "Bash", input: { command: "ls -la", description: "List files" }, toolUseId: "tu-1",
      title: "List files" });
    const result = detail(2, DetailKind.Note, "a.ts", { toolUseId: "tu-1", isError: false });
    const step = (shown: MessageDetail, output: MessageDetail | null = null): [string, string | null] => {
      const entry = new ActivityEntry(shown, output);
      return [formatter().title(shown, "D:\\repo"), formatter().bodyOf(entry)];
    };

    expect(step(codex)).toEqual(["Searched for foo in .\\src", codex.text]);
    expect(step(claude, result)).toEqual(["List files", "Bash: ls -la\na.ts"]);
    expect(formatter().callOf(new ActivityEntry(claude, result), false, null).title).toBe("List files");
  });

  it("titles a page tool's step by what it did: the shown file, the listed count, the read page and version, and the edit's versions, as it runs and once it fails", () => {
    const page = SamplePages.page("p1", "Onboarding options", 2);
    const show = detail(1, DetailKind.Note, "Show a page", { tool: "mcp__teamrun__teamrun_show_page", toolUseId: "u1", input: { path: "out\\options.html", title: "Onboarding options" } });
    const list = detail(2, DetailKind.Note, "List pages", { tool: "mcp__teamrun__teamrun_list_pages", toolUseId: "u2", input: {} });
    const read = detail(3, DetailKind.Note, "Read a page", { tool: "mcp__teamrun__teamrun_read_page", toolUseId: "u3", input: { page_id: "p1" } });
    const edit = detail(4, DetailKind.Note, "Edit a page", { tool: "mcp__teamrun__teamrun_edit_page", toolUseId: "u4", input: { page_id: "p1", base_version: 1 } });
    const result = (sequence: number, toolUseId: string, value: JsonValue, isError: boolean = false): MessageDetail =>
      detail(sequence, DetailKind.Note, Object.isString(value) ? value : JSON.stringify(value), { toolUseId, ...isError ? { isError: true } : {} });
    const call = (shown: MessageDetail, output: MessageDetail | null = null, isRunning: boolean = false): [string, ToolCallStatus] => {
      const made = formatter().callOf(new ActivityEntry(shown, output), isRunning, null);
      return [made.title, made.status];
    };
    const codex = detail(5, DetailKind.Note, "MCP tool teamrun/teamrun_show_page\nThe page is over 2 MB.",
      { server: "teamrun", tool: "teamrun_show_page", status: "failed", arguments: { path: "big.html" } });

    expect([
      call(show, result(6, "u1", SamplePages.page("p1", "Onboarding options").toJson())),
      call(list, result(7, "u2", { pages: [page.toJson(), SamplePages.page("p2", "Launch checklist").toJson()] })),
      call(read, result(8, "u3", [{ type: "text", text: JSON.stringify({ page: page.toJson(), version: 2, html: "<p>hi</p>" }) }])),
      call(edit, result(9, "u4", page.toJson())),
      call(edit, null, true),
      call(show, result(10, "u1", "The file isn't in the chat's folder.\nmore", true)),
      call(codex)
    ]).toEqual([
      ["Showed a page · options.html", ToolCallStatus.Succeeded],
      ["Listed the chat's pages · 2 pages", ToolCallStatus.Succeeded],
      ["Read a page · Onboarding options, v2", ToolCallStatus.Succeeded],
      ["Edited a page · v1 to v2", ToolCallStatus.Succeeded],
      ["Editing a page", ToolCallStatus.Running],
      ["Couldn't show a page: The file isn't in the chat's folder.", ToolCallStatus.Failed],
      ["Couldn't show a page: The page is over 2 MB.", ToolCallStatus.Failed]
    ]);
    expect(formatter().stepOf(new ActivityEntry(list, result(7, "u2", { pages: [page.toJson()] })), null).title).toBe("Listed the chat's pages · 1 page");
  });

  it("titles a Browser call's step by what it did to the page, and marks one the person denied as denied", () => {
    const click = { tool: "mcp__teamrun__browser_click", input: { ref: "e5" }, toolUseId: "tu-5", servedTool: "browser_click", servedInput: { ref: "e5" } };
    const clicked = detail(1, DetailKind.Note, "mcp__teamrun__browser_click", { ...click, element: { role: "button", name: "Pay", isSecret: false } });
    const denied = detail(2, DetailKind.Note, "mcp__teamrun__browser_click", { ...click, failure: { code: "Denied", moduleCode: null } });
    const refused = detail(4, DetailKind.Note, "mcp__teamrun__browser_click", click);
    const claudeDenied = detail(5, DetailKind.Note, "Denied by the TeamRun user.", { toolUseId: "tu-5", isError: true, denied: true });
    const call = (shown: MessageDetail, output: MessageDetail | null = null): [string, ToolCallStatus] => {
      const made = formatter().callOf(new ActivityEntry(shown, output), false, null);
      return [made.title, made.status];
    };

    expect([call(clicked), call(denied), call(refused, claudeDenied)]).toEqual([
      ["Clicked \"Pay\"", ToolCallStatus.Succeeded],
      ["Didn't click an element · you denied it", ToolCallStatus.Denied],
      ["Didn't click an element · you denied it", ToolCallStatus.Denied]
    ]);
  });

  it("titles a Browser step without its record by its status: running or waiting as in progress, and failed or cut off as not done", () => {
    const click = detail(1, DetailKind.Note, "mcp__teamrun__browser_click",
      { tool: "mcp__teamrun__browser_click", input: { ref: "e5" }, toolUseId: "tu-1", servedTool: "browser_click", servedInput: { ref: "e5" } });
    const failed = detail(2, DetailKind.Note, "The tool call failed.", { toolUseId: "tu-1", isError: true });
    const made = [
      formatter().callOf(new ActivityEntry(click, null), true, null),
      formatter().callOf(new ActivityEntry(click, null), true, null, false, false, true),
      formatter().callOf(new ActivityEntry(click, failed), false, null),
      formatter().callOf(new ActivityEntry(click, null), false, null, true),
      formatter().callOf(new ActivityEntry(click, null), false, null)
    ];

    expect(made.map(t => [t.title, t.status])).toEqual([
      ["Clicking an element", ToolCallStatus.Running],
      ["Clicking an element", ToolCallStatus.AwaitingPermission],
      ["Didn't click an element", ToolCallStatus.Failed],
      ["Didn't click an element", ToolCallStatus.Cancelled],
      ["Clicked an element", ToolCallStatus.Succeeded]
    ]);
  });

  it("opens a Browser step onto the page it left and the screenshot TeamRun stored of it, and no other step", () => {
    const stored = "D:\\data\\images\\r1-1.png";
    const page = { servedTool: "browser_screenshot", servedInput: {}, page: { url: "https://shop.test/cart", title: "Cart" } };
    const message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.Note, "mcp__teamrun__read", { tool: "mcp__teamrun__read", toolUseId: "tu-0", storedPath: stored }),
      detail(1, DetailKind.Note, "mcp__teamrun__browser_screenshot", { tool: "mcp__teamrun__browser_screenshot", toolUseId: "tu-1", ...page, storedPath: stored }),
      detail(2, DetailKind.Note, "mcp__teamrun__browser_screenshot", { tool: "mcp__teamrun__browser_screenshot", toolUseId: "tu-2", ...page }),
      detail(3, DetailKind.Note, "mcp__teamrun__browser_snapshot", { tool: "mcp__teamrun__browser_snapshot", toolUseId: "tu-3", servedTool: "browser_snapshot" })
    ]);
    const shot = formatter().screenshotOf(message, 1);

    expect([shot?.key, shot?.conversationId, shot?.messageId, shot?.path]).toEqual([`${message.id}:${stored}`, message.conversationId, message.id, stored]);
    expect([0, 2, 3, 4].map(t => formatter().screenshotOf(message, t))).toEqual([null, null, null, null]);
    expect([0, 1, 2, 3, 4].map(t => formatter().pageOf(message, t))).toEqual([null, "shop.test/cart", "shop.test/cart", null, null]);
    expect(message.details.map(t => formatter().callOf(new ActivityEntry(t, null), false, null).hasOutputControl)).toEqual([false, true, true, false]);
  });

  const browserCall = (index: number, tool: string, fields: JsonObject = {}): readonly [MessageDetail, MessageDetail] => [
    detail(index * 2, DetailKind.Note, `mcp__teamrun__${tool}`, { tool: `mcp__teamrun__${tool}`, toolUseId: `tu-${index}`, servedTool: tool, servedInput: {},
      page: { url: "https://shop.test/cart", title: "Cart" }, ...fields }),
    detail(index * 2 + 1, DetailKind.Note, "done", { toolUseId: `tu-${index}`, isError: false })
  ];

  it("lists a reply's Browser calls allowed without asking, a finished read and a change allowed at Low risk without a card, in their order, naming an address once", () => {
    const decided = (risk: string, decision: string, isAsked = false): JsonObject => ({ permission: { risk, decision, isRemembered: false, isAsked } });
    const pay = { element: { role: "button", name: "Pay", isSecret: false } };
    const message = reply([
      ...browserCall(0, "browser_snapshot"),
      ...browserCall(1, "browser_click", { ...pay, ...decided("Low", "AllowedOnce") }),
      ...browserCall(2, "browser_click", { ...pay, ...decided("Medium", "AllowedOnce") }),
      ...browserCall(3, "browser_click", pay),
      ...browserCall(4, "browser_navigate", decided("Low", "Denied")),
      ...browserCall(5, "browser_console", { failure: { code: "Failed", moduleCode: null } }),
      detail(12, DetailKind.Note, "mcp__teamrun__read", { tool: "mcp__teamrun__read", toolUseId: "tu-6" }),
      detail(13, DetailKind.Note, "done", { toolUseId: "tu-6", isError: false }),
      ...browserCall(7, "browser_screenshot", decided("Low", "AllowedAlways")),
      ...browserCall(8, "browser_click", { ...pay, ...decided("Low", "AllowedOnce", true) }),
      ...browserCall(9, "browser_wait_for", { servedInput: { text: "Cart total", timeoutMilliseconds: 5000 } }),
      ...browserCall(10, "browser_console", { page: { url: "https://docs.example.com/pricing", title: "Pricing" } })
    ]);

    expect(formatter().allowedWithoutAsking(message)).toEqual([
      "read shop.test/cart", "clicked \"Pay\"", "took a screenshot", "waited for \"Cart total\"", "read the console of docs.example.com/pricing"
    ]);
  });

  it("leaves a Browser read out of the calls allowed without asking until its result comes, and a read that ended in an error", () => {
    const [shot, done] = browserCall(0, "browser_screenshot");
    const failed = detail(1, DetailKind.Note, "failed", { toolUseId: "tu-0", isError: true });
    const listed = [[shot], [shot, done], [shot, failed]].flatMap(details => [MessageStatus.Running, MessageStatus.Completed].map(status =>
      formatter().allowedWithoutAsking(reply(details, status))));

    expect(listed).toEqual([[], [], ["took a screenshot of shop.test/cart"], ["took a screenshot of shop.test/cart"], [], []]);
  });

  it("keeps an ACP command's own title, its text's first line, when ACP's raw title runs over lines or past what the text holds", () => {
    const acp = (text: string, title: string): [string, string | null] => {
      const shown = detail(0, DetailKind.Command, text, { toolCallId: "c1", tool: "execute", status: "completed", title });
      return [formatter().title(shown), formatter().body(shown)];
    };
    const long = "npm test ".repeat(70);

    expect(acp("Run npm test\nin the app folder", "Run npm test\nin the app folder")).toEqual(["Run npm test", "in the app folder"]);
    expect(acp(long.slice(0, 500), long)).toEqual([long.slice(0, 500), null]);
  });

  it("keeps a command's own first line as its title when its title is blank, matches that line, or is not text, and ignores a title on another step", () => {
    const titled = (kind: DetailKind, title: JsonValue): [string, string | null] => {
      const shown = detail(0, kind, "$ npm test\nok", { command: "npm test", title });
      return [formatter().title(shown), formatter().body(shown)];
    };

    expect([
      titled(DetailKind.Command, "Ran the tests"), titled(DetailKind.Command, " "), titled(DetailKind.Command, "$ npm test"), titled(DetailKind.Command, 3),
      titled(DetailKind.Note, "Ran the tests")
    ]).toEqual([["Ran the tests", "$ npm test\nok"], ["$ npm test", "ok"], ["$ npm test", "ok"], ["$ npm test", "ok"], ["$ npm test", "ok"]]);
  });

  it("gives an Activity row its tool's glyph, or for a step with no tool the glyph of its kind, and keeps a blank title blank", () => {
    const stepOf = (shown: MessageDetail): [string, string, boolean] => {
      const step = formatter().stepOf(new ActivityEntry(shown, null), null);
      return [step.glyph, step.title, step.isFailed];
    };

    expect([
      stepOf(detail(0, DetailKind.Error, "Resume failed")),
      stepOf(detail(1, DetailKind.Note, "Account info unavailable")),
      stepOf(detail(2, DetailKind.Text, "Working on it")),
      stepOf(detail(3, DetailKind.Note, "Task: plan", { tool: "Task" })),
      stepOf(detail(4, DetailKind.Note, "  "))
    ]).toEqual([["error", "Resume failed", true], ["info", "Account info unavailable", false], ["notes", "Working on it", false],
      ["build", "Task: plan", false], ["info", "  ", false]]);
    expect(formatter().callOf(new ActivityEntry(detail(4, DetailKind.Note, "  "), null), false, null).title).toBe(Resources.stepLabel);
  });

  it("titles a thought, and a note or text with no tool, with its text and no Markdown marks, and keeps the marks in its body", () => {
    const titleOf = (shown: MessageDetail): [string, string] =>
      [formatter().stepOf(new ActivityEntry(shown, null), null).title, formatter().callOf(new ActivityEntry(shown, null), false, null).title];
    const thought = (text: string): MessageDetail => detail(0, DetailKind.Reasoning, text);

    expect([
      titleOf(thought("**Responding to greetings**\n\nThe person said hello.")),
      titleOf(thought("**Plan.** Read **the** files.")),
      titleOf(thought("*Weighing* the `--force` flag, __both__ and ~~old~~ options")),
      titleOf(thought("Reading [the guide](https://example.com/guide), [its notes][notes] and <https://example.com/faq>")),
      titleOf(thought("![The diagram](diagram.png) shows ***it*** and _this_")),
      titleOf(thought("Keeping \\*literal\\* stars, snake_case_names, 2 * 3 and a \\`tick")),
      titleOf(thought("Running `**/*.ts`, `` a`b `` and `\\*`")),
      titleOf(detail(1, DetailKind.Note, "**Session ended**\nThe tools were closed.")),
      titleOf(detail(2, DetailKind.Text, "_Working_ on it"))
    ]).toEqual([
      "Responding to greetings",
      "Plan.",
      "Weighing the --force flag, both and old options",
      "Reading the guide, its notes and https://example.com/faq",
      "The diagram shows it and this",
      "Keeping *literal* stars, snake_case_names, 2 * 3 and a `tick",
      "Running **/*.ts, a`b and \\*",
      "Session ended",
      "Working on it"
    ].map(t => [t, t]));
    expect([formatter().body(thought("**Plan.** Read **the** files.")), formatter().body(thought("**Responding to greetings**\n\nThe person said hello."))])
      .toEqual(["Read **the** files.", "The person said hello."]);
  });

  it("keeps the Markdown marks in the title of a command or a tool's step, which are not prose", () => {
    const titleOf = (shown: MessageDetail): string => formatter().stepOf(new ActivityEntry(shown, null), null).title;

    expect([
      titleOf(detail(0, DetailKind.Command, "> grep -n \"a*b*c\" **/*.ts")),
      titleOf(detail(1, DetailKind.Note, "Read: **notes**.md", { tool: "Read" })),
      titleOf(detail(2, DetailKind.FileChange, "Edit: __init__.py")),
      titleOf(detail(3, DetailKind.Error, "**denied**"))
    ]).toEqual(["> grep -n \"a*b*c\" **/*.ts", "Read: **notes**.md", "Edit: __init__.py", "**denied**"]);
  });

  it("marks a command still in progress when its reply ends, cancelled or not, as cancelled rather than succeeded", () => {
    const steps = [detail(0, DetailKind.Command, "> a", { status: "completed", exitCode: 0 }), detail(1, DetailKind.Command, "> b", { status: "inProgress" })];
    const statusesOf = (status: MessageStatus): ToolCallStatus[] => {
      const ended = reply(steps, status);
      return formatter().callsOf(ended, formatter().activity(ended), null).map(t => t.status);
    };

    expect(statusesOf(MessageStatus.Cancelled)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Cancelled]);
    expect(statusesOf(MessageStatus.Completed)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Cancelled]);
    expect(statusesOf(MessageStatus.Running)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Running]);
  });

  it("runs a Claude tool call until its result comes, every parallel call at once, and cancels one whose reply ends first", () => {
    const bash = (sequence: number, id: string): MessageDetail => detail(sequence, DetailKind.Command, "> npm test", { tool: "Bash", toolUseId: id });
    const result = (sequence: number, id: string): MessageDetail => detail(sequence, DetailKind.Note, "ok", { toolUseId: id });
    const statusesOf = (details: readonly MessageDetail[], status: MessageStatus): ToolCallStatus[] => {
      const shown = reply(details, status);
      return formatter().callsOf(shown, formatter().activity(shown), null).map(t => t.status);
    };
    const parallel = [detail(0, DetailKind.Command, "> a"), bash(1, "t1"), bash(2, "t2")];

    expect(statusesOf(parallel, MessageStatus.Running)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Running, ToolCallStatus.Running]);
    expect(statusesOf([...parallel, result(3, "t1")], MessageStatus.Running)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded, ToolCallStatus.Running]);
    expect(statusesOf([...parallel, result(3, "t1"), result(4, "t2")], MessageStatus.Running))
      .toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded, ToolCallStatus.Succeeded]);
    expect(statusesOf([...parallel, result(3, "t1")], MessageStatus.Cancelled)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded, ToolCallStatus.Cancelled]);
    expect(statusesOf([...parallel, result(3, "t1"), result(4, "t2")], MessageStatus.Completed))
      .toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded, ToolCallStatus.Succeeded]);
    expect(statusesOf([result(0, "t9")], MessageStatus.Cancelled)).toEqual([ToolCallStatus.Succeeded]);
    expect(formatter().callsOf(reply([], MessageStatus.Running), [], null)).toEqual([]);
  });

  it("notes \"waiting for your answer\" on only the open step whose pending permission names its served call, with two Browser steps open or a finished one of the same call, and on none for a permission naming no call, another tool, or a step without its input", () => {
    const click = (sequence: number, ref: string, served: JsonObject = { servedInput: { ref } }, id: string = `tu-${ref}`): MessageDetail => detail(sequence,
      DetailKind.Note, "mcp__teamrun__browser_click", { tool: "mcp__teamrun__browser_click", toolUseId: id, servedTool: "browser_click", ...served });
    const notesOf = (details: readonly MessageDetail[], asked: readonly PermissionPayload[]): (string | null)[] => {
      const shown = reply(details, MessageStatus.AwaitingApproval);
      return formatter().callsOf(shown, formatter().activity(shown), null, false, false, null, undefined, asked).map(t => t.note);
    };
    const naming = (tool: string, input: JsonObject): PermissionPayload => new PermissionPayload("browser", "p1", PermissionRisk.Medium, [], { tool, input });
    const steps = [click(0, "e5"), click(1, "e7")];

    expect([
      notesOf(steps, [naming("browser_click", { ref: "e7" })]),
      notesOf(steps, [naming("browser_click", { ref: "e5" })]),
      notesOf(steps, [new PermissionPayload("browser", "p1", PermissionRisk.Medium, [])]),
      notesOf(steps, [naming("browser_type", { ref: "e7" })]),
      notesOf(steps, []),
      notesOf([click(0, "e5", {})], [naming("browser_click", { ref: "e5" })]),
      notesOf([click(0, "e5"), detail(1, DetailKind.Note, "ok", { toolUseId: "tu-e5" }), click(2, "e5", { servedInput: { ref: "e5" } }, "tu-again")],
        [naming("browser_click", { ref: "e5" })])
    ]).toEqual([[null, "waiting for your answer"], ["waiting for your answer", null], [null, null], [null, null], [null, null], [null],
      [null, "waiting for your answer"]]);
  });

  it("says each open step of a reply awaiting approval waits for permission, or for an answer when only questions wait, a Claude call, a Codex step or an untracked last step, and keeps the others' states", () => {
    const statusesOf = (details: readonly MessageDetail[]): ToolCallStatus[] => {
      const shown = reply(details, MessageStatus.AwaitingApproval);
      return formatter().callsOf(shown, formatter().activity(shown), null).map(t => t.status);
    };
    const change = (status: string): MessageDetail => detail(0, DetailKind.FileChange, "Step", { files: ["a.ts"], status });

    expect(statusesOf([detail(0, DetailKind.Command, "> a"), detail(1, DetailKind.Command, "> npm test", { tool: "Bash", toolUseId: "t1" })]))
      .toEqual([ToolCallStatus.Succeeded, ToolCallStatus.AwaitingPermission]);
    expect([statusesOf([change("inProgress")]), statusesOf([change("declined")]), statusesOf([change("completed")])])
      .toEqual([[ToolCallStatus.AwaitingPermission], [ToolCallStatus.Cancelled], [ToolCallStatus.Succeeded]]);
    expect(statusesOf([detail(0, DetailKind.Command, "> a")])).toEqual([ToolCallStatus.AwaitingPermission]);
    const asking = reply([detail(0, DetailKind.Command, "> a"), detail(1, DetailKind.Command, "> b")], MessageStatus.AwaitingApproval);
    expect(formatter().callsOf(asking, formatter().activity(asking), null, false, true).map(t => t.status))
      .toEqual([ToolCallStatus.Succeeded, ToolCallStatus.AwaitingAnswer]);
  });

  it("ends a Claude tool call on a blank result, shows no output for it, and fails it on a blank error result", () => {
    const mkdir = detail(0, DetailKind.Command, "Bash: mkdir out", { tool: "Bash", toolUseId: "t1" });
    const blank = (isError: boolean): MessageDetail => detail(1, DetailKind.Note, "", { toolUseId: "t1", isError });
    const callOf = (result: MessageDetail): ToolCall | undefined => {
      const shown = reply([mkdir, result], MessageStatus.Running);
      return formatter().callsOf(shown, formatter().activity(shown), null)[0];
    };

    expect(callOf(blank(false))?.status).toBe(ToolCallStatus.Succeeded);
    expect(callOf(blank(false))?.output).toBeNull();
    expect(callOf(blank(true))?.status).toBe(ToolCallStatus.Failed);
    expect(formatter().bodyOf(new ActivityEntry(detail(0, DetailKind.Command, "> a\nout"), blank(false)))).toBe("out");
  });

  it.each([
    { step: "an ACP edit", kind: DetailKind.FileChange, payload: { toolCallId: "e1", tool: "edit" }, failed: "failed" },
    { step: "an ACP read", kind: DetailKind.Note, payload: { toolCallId: "r1", tool: "read" }, failed: "failed" },
    { step: "a Codex file change", kind: DetailKind.FileChange, payload: { files: ["a.ts"] }, failed: "failed" },
    { step: "a Codex MCP call", kind: DetailKind.Note, payload: { server: "docs", tool: "search" }, failed: "failed" },
    { step: "a Codex dynamic tool call", kind: DetailKind.Note, payload: { tool: "fetch" }, failed: "failed" }
  ])("fails $step on its own $failed status, and runs and ends it on its others", ({ kind, payload, failed }) => {
    const statusOf = (status: string, shown: MessageStatus): ToolCallStatus | undefined => {
      const message = reply([detail(0, kind, "Step", { ...payload, status })], shown);
      return formatter().callsOf(message, formatter().activity(message), null)[0]?.status;
    };

    expect([statusOf(failed, MessageStatus.Running), statusOf(failed, MessageStatus.Completed)]).toEqual([ToolCallStatus.Failed, ToolCallStatus.Failed]);
    expect(statusOf("completed", MessageStatus.Running)).toBe(ToolCallStatus.Succeeded);
    expect([statusOf("inProgress", MessageStatus.Running), statusOf("inProgress", MessageStatus.Cancelled)]).toEqual([ToolCallStatus.Running, ToolCallStatus.Cancelled]);
  });

  it.each([
    { step: "a Claude command", steps: [detail(0, DetailKind.Command, "Bash: rm -rf build", { tool: "Bash", toolUseId: "t1" }),
      detail(1, DetailKind.Note, "The person denied it.", { toolUseId: "t1", isError: true, denied: true })] },
    { step: "an ACP command", steps: [detail(0, DetailKind.Command, "rm -rf build", { toolCallId: "c1", tool: "execute", status: "failed", denied: true })] },
    { step: "a Codex command", steps: [detail(0, DetailKind.Command, "rm -rf build", { command: "rm -rf build", exitCode: null, status: "declined", denied: true })] },
    { step: "a Codex file change", steps: [detail(0, DetailKind.FileChange, "Edit", { files: ["a.ts"], status: "declined", denied: true })] }
  ])("shows $step the person denied as Denied, not Failed, in its header and in Activity", ({ steps }) => {
    const message = reply(steps, MessageStatus.Completed);
    const activity = formatter().activity(message);

    expect(formatter().callsOf(message, activity, null).map(t => t.status)).toEqual([ToolCallStatus.Denied]);
    expect(activity.map(t => formatter().stepOf(t, null)).map(t => [t.isFailed, t.isDenied])).toEqual([[false, true]]);
  });

  it("shows a Codex command or file change that ends declined but not denied as Cancelled, as an ACP step its reply ended before shows", () => {
    const message = reply([
      detail(0, DetailKind.Command, "rm -rf build", { command: "rm -rf build", exitCode: null, status: "declined" }),
      detail(1, DetailKind.FileChange, "Edit", { files: ["a.ts"], status: "declined" }),
      detail(2, DetailKind.Command, "npm test", { toolCallId: "c1", tool: "execute", status: "pending" })
    ], MessageStatus.Cancelled);

    expect(formatter().callsOf(message, formatter().activity(message), null).map(t => t.status))
      .toEqual([ToolCallStatus.Cancelled, ToolCallStatus.Cancelled, ToolCallStatus.Cancelled]);
  });

  it("pairs a result with its tool call across the answer between them, and adds no step for it", () => {
    const steps = [
      detail(0, DetailKind.Command, "Bash: mkdir out", { tool: "Bash", toolUseId: "t1" }),
      detail(1, DetailKind.Text, "Making the folder."),
      detail(2, DetailKind.Note, "", { toolUseId: "t1", isError: false }),
      detail(3, DetailKind.Command, "Bash: ls", { tool: "Bash", toolUseId: "t2" }),
      detail(4, DetailKind.Text, "Listing it."),
      detail(5, DetailKind.Note, "out", { toolUseId: "t2", isError: false })
    ];
    const message = reply(steps, MessageStatus.Running);
    const segments = formatter().segments(message);

    expect(segments.map(t => [t.kind, t.entries.map(u => [u.detail.sequence, u.result?.sequence ?? null])])).toEqual([
      [SegmentKind.Activity, [[0, 2]]], [SegmentKind.Text, []], [SegmentKind.Activity, [[3, 5]]], [SegmentKind.Text, []]
    ]);
    expect(formatter().callsOf(message, formatter().activity(message), null).map(t => [t.status, t.output])).toEqual([
      [ToolCallStatus.Succeeded, null], [ToolCallStatus.Succeeded, "out"]
    ]);
  });

  it("runs an ACP command while it is pending or in progress, cancels it when its reply ends first, and ends it on its final status", () => {
    const execute = (status: string): MessageDetail => detail(0, DetailKind.Command, "npm test", { toolCallId: "c1", tool: "execute", status });
    const statusOf = (step: MessageDetail, status: MessageStatus): ToolCallStatus | undefined => {
      const shown = reply([step], status);
      return formatter().callsOf(shown, formatter().activity(shown), null)[0]?.status;
    };

    for (const open of ["pending", "in_progress"])
      expect([MessageStatus.Running, MessageStatus.Cancelled, MessageStatus.Completed].map(t => statusOf(execute(open), t)))
        .toEqual([ToolCallStatus.Running, ToolCallStatus.Cancelled, ToolCallStatus.Cancelled]);
    expect([statusOf(execute("completed"), MessageStatus.Running), statusOf(execute("completed"), MessageStatus.Cancelled)])
      .toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded]);
    expect(statusOf(execute("failed"), MessageStatus.Running)).toBe(ToolCallStatus.Failed);
  });

  it("keeps the note a cancelled reply stored out of its steps and its summary, and keeps a note with the same text in any other reply", () => {
    const command = detail(0, DetailKind.Command, "> a", { status: "inProgress" });
    const stopped = detail(1, DetailKind.Note, "The reply was cancelled.");
    const cancelled = reply([command, stopped], MessageStatus.Cancelled);

    expect(formatter().activity(cancelled).map(t => t.detail)).toEqual([command]);
    expect(formatter().callsOf(cancelled, formatter().activity(cancelled), null).map(t => t.status)).toEqual([ToolCallStatus.Cancelled]);
    expect(formatter().activitySummary(formatter().activity(cancelled))).toBe("Ran 1 command");
    expect(formatter().segments(reply([stopped], MessageStatus.Cancelled))).toEqual([]);
    expect(formatter().segments(reply([detail(0, DetailKind.Note, "Cancelled before this participant started.")], MessageStatus.Cancelled))).toEqual([]);
    expect(formatter().activity(reply([stopped], MessageStatus.Completed)).map(t => t.detail)).toEqual([stopped]);
  });

  it("runs a last step with no status or tool call while its reply is active, and never marks it cut off", () => {
    const steps = [detail(0, DetailKind.Command, "> a", { status: "completed" }), detail(1, DetailKind.Reasoning, "Planning.")];
    const statusesOf = (status: MessageStatus): ToolCallStatus[] => {
      const shown = reply(steps, status);
      return formatter().callsOf(shown, formatter().activity(shown), null).map(t => t.status);
    };

    expect(statusesOf(MessageStatus.Running)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Running]);
    expect(statusesOf(MessageStatus.Cancelled)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded]);
    expect(statusesOf(MessageStatus.Completed)).toEqual([ToolCallStatus.Succeeded, ToolCallStatus.Succeeded]);
  });

  it("fails a command on a non-zero exit or a failed status, with its exit code, cancels a declined one, and runs it only until its status ends", () => {
    const command = (sequence: number, exitCode: number | null, status: string): MessageDetail =>
      detail(sequence, DetailKind.Command, "$ x", { command: "x", cwd: null, exitCode, status });
    const steps = [command(0, -1, "failed"), command(1, null, "declined"), command(2, 2, "completed"), command(3, 0, "completed")];
    const working = reply([...steps, command(4, null, "inProgress")], MessageStatus.Running);
    const ended = reply(steps, MessageStatus.Running);

    expect(formatter().callsOf(working, formatter().activity(working), null).map(t => [t.status, t.error])).toEqual([
      [ToolCallStatus.Failed, Resources.formatExitCode(-1)], [ToolCallStatus.Cancelled, null], [ToolCallStatus.Failed, Resources.formatExitCode(2)],
      [ToolCallStatus.Succeeded, null], [ToolCallStatus.Running, null]
    ]);
    expect(formatter().callsOf(ended, formatter().activity(ended), null).at(-1)?.status).toBe(ToolCallStatus.Succeeded);
  });

  it("labels activity with the duration and the step count", () => {
    const running = reply([detail(0, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" })], MessageStatus.Running);
    const start = Date.parse(SampleData.timestamp);

    expect(formatter().activityLabel(running, start + 12_000)).toBe(Resources.formatWorkingFor("12s"));
    expect(formatter().activityLabel(reply([]), start)).toBe(Resources.formatWorkedFor("0s"));
    expect([MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval, MessageStatus.Completed].map(t => formatter().isActive(reply([], t))))
      .toEqual([true, true, true, false]);
  });

  it("lets a working reply stop, and a finished one while one of its sub-agents still runs", () => {
    const agent = (status: SubAgentStatus): MessageDetail =>
      detail(1, DetailKind.SubAgent, "Explore", new SubAgent("ta", null, "Explore", null, status, true).toJson());
    const step = detail(0, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" });

    expect([reply([step], MessageStatus.Running), reply([step]), reply([step, agent(SubAgentStatus.Running)]), reply([step, agent(SubAgentStatus.Stopped)])]
      .map(t => formatter().canStop(t))).toEqual([true, false, true, false]);
  });

  it("says a working reply is thinking, timed from its start, until its first thought, step or text, and again while its provider says it thinks", () => {
    const at = Date.parse(SampleData.timestamp) + 12_000;
    const label = (details: readonly MessageDetail[], status: MessageStatus, activity: ReplyActivity | null = null): string =>
      formatter().activityLabel(reply(details, status), at, activity);

    expect([
      label([], MessageStatus.Running),
      label([detail(0, DetailKind.Reasoning, "Weighing it.")], MessageStatus.Running),
      label([detail(0, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" })], MessageStatus.Running),
      label([detail(0, DetailKind.Text, "Hello")], MessageStatus.Running),
      label([detail(0, DetailKind.Text, "Hello")], MessageStatus.Running, ReplyActivity.Thinking),
      label([], MessageStatus.AwaitingApproval),
      label([], MessageStatus.Pending, ReplyActivity.Thinking),
      label([], MessageStatus.Completed, ReplyActivity.Thinking)
    ]).toEqual(["Thinking… 12s", "Working for 12s", "Working for 12s", "Working for 12s", "Thinking… 12s", "Working for 12s", "Waiting for its turn", "Worked for 0s"]);
  });

  it("says a working reply is saving a checkpoint, timed from its start, or stopping, and a reply that isn't working what it did", () => {
    const at = Date.parse(SampleData.timestamp) + 12_000;
    const label = (status: MessageStatus, activity: ReplyActivity): string =>
      formatter().activityLabel(reply([detail(0, DetailKind.Text, "Hello")], status), at, activity);

    expect([
      label(MessageStatus.Running, ReplyActivity.SavingCheckpoint),
      label(MessageStatus.Running, ReplyActivity.Stopping),
      label(MessageStatus.AwaitingApproval, ReplyActivity.Stopping),
      label(MessageStatus.Pending, ReplyActivity.SavingCheckpoint),
      label(MessageStatus.Completed, ReplyActivity.Stopping),
      label(MessageStatus.Cancelled, ReplyActivity.SavingCheckpoint)
    ]).toEqual(["Saving a checkpoint… 12s", "Stopping…", "Stopping…", "Waiting for its turn", "Worked for 0s", "Worked for 0s"]);
  });

  it("reads a thought's latest line as the first sentence of its last paragraph, without Markdown marks", () => {
    expect([
      formatter().latestThought(detail(0, DetailKind.Reasoning, "Weighing a temporary project. Then the build.\n\n  \n**Checking** the `tests` first. Then the rest.")),
      formatter().latestThought(detail(0, DetailKind.Reasoning, "One thought\nwith a second line")),
      formatter().latestThought(detail(0, DetailKind.Reasoning, "Done.\n\n"))
    ]).toEqual(["Checking the tests first.", "One thought", "Done."]);
  });

  it("titles a growing reply's newest thought with its latest line, or Thinking… before it has one, and every other step as before", () => {
    const working = reply([
      detail(0, DetailKind.Reasoning, "First idea. More."),
      detail(1, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t1" }),
      detail(2, DetailKind.Reasoning, "Second idea. Details.\n\nThird idea. Even more.")
    ], MessageStatus.Running);
    const titles = (shown: Message, isGrowing: boolean): readonly string[] =>
      formatter().callsOf(shown, formatter().activity(shown), null, isGrowing).map(t => t.title);
    const blank = reply([detail(0, DetailKind.Reasoning, String.empty)], MessageStatus.Running);
    const stepLast = reply([...working.details, detail(3, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t2" })], MessageStatus.Running);

    expect(titles(working, true)).toEqual(["First idea.", "> ls", "Third idea."]);
    expect(titles(working, false)).toEqual(["First idea.", "> ls", "Second idea."]);
    expect(titles(blank, true)).toEqual([Resources.thinkingLabel]);
    expect(titles(blank, false)).toEqual([Resources.stepLabel]);
    expect(titles(stepLast, true)).toEqual(["First idea.", "> ls", "Second idea.", "> make"]);
  });

  it("labels a reply waiting for its turn without a duration", () => {
    const pending = reply([], MessageStatus.Pending);

    expect(formatter().isWaitingForTurn(pending)).toBe(true);
    expect(formatter().isWaitingForTurn(reply([], MessageStatus.Running))).toBe(false);
    expect(formatter().activityLabel(pending, Date.parse(SampleData.timestamp) + 12_000)).toBe("Waiting for its turn");
  });

  it("measures a reply from its start, not from the message it answers", () => {
    const sent = Date.parse(SampleData.timestamp);
    const at = (offset: number): string => new Date(sent + offset).toISOString();
    const waited = (status: MessageStatus, startedAt: string | null, endedAt: string | null): Message =>
      new Message("m9", "c1", 2, MessageAuthor.Provider, "m1", status, [], SampleData.provenance, SampleData.timestamp, startedAt, endedAt);

    expect(formatter().activityLabel(waited(MessageStatus.Running, at(30_000), null), sent + 40_000)).toBe("Thinking… 10s");
    expect(formatter().activityLabel(waited(MessageStatus.Completed, at(30_000), at(42_000)), sent + 90_000)).toBe("Worked for 12s");
    expect(formatter().activityLabel(waited(MessageStatus.Cancelled, null, at(30_000)), sent + 90_000)).toBe("Did not start");
  });

  it("describes the model and effort a reply ran with, naming a provider's default model as the provider does", () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const kinds = [SampleData.codex, copilot];
    const settings = (requested: RequestedSettings, observed: ObservedSettings): Message => kind(new Provenance(null, requested, observed, null, false));
    const none = new ObservedSettings(null, null, null, null);

    expect(formatter().modelLine(SampleData.reply, kinds)).toBe("gpt-5 · high");
    expect(formatter().modelLine(settings(new RequestedSettings("codex", "gpt-5", null), new ObservedSettings("codex", "gpt-5-mini", "low", null)), kinds))
      .toBe("gpt-5-mini · low");
    expect(formatter().modelLine(settings(new RequestedSettings("codex", null, null), none), kinds)).toBeNull();
    expect(formatter().modelLine(settings(new RequestedSettings("codex", null, "low"), none), kinds)).toBe("low");
    expect(formatter().modelLine(settings(new RequestedSettings("copilot", null, "medium"), none), kinds)).toBe("Auto · medium");
    expect(formatter().modelLine(settings(new RequestedSettings("copilot", "kimi-k3", "medium"), new ObservedSettings("copilot", null, "medium", null, true)), kinds))
      .toBe("Auto, kimi-k3 not available · medium");
    expect(formatter().modelLine(settings(new RequestedSettings("codex", "gpt-x", null), new ObservedSettings("codex", null, null, null, true)), kinds))
      .toBe("Default model, gpt-x not available");
    expect(formatter().modelLine(settings(new RequestedSettings("copilot", "kimi-k3", null), new ObservedSettings("copilot", null, null, null)), kinds))
      .toBe("kimi-k3");
    expect(formatter().modelLine(settings(new RequestedSettings("copilot", null, null), new ObservedSettings("copilot", null, null, null, true)), kinds))
      .toBe("Auto");
    expect(formatter().modelLine(settings(new RequestedSettings("codex", null, null), new ObservedSettings("copilot", null, "high", null)), kinds))
      .toBe("Auto · high");
    expect(formatter().modelLine(settings(new RequestedSettings("gone", null, "low"), none), kinds)).toBe("low");
    expect(formatter().modelLine(SampleData.userMessage, kinds)).toBeNull();
  });

  it("describes a reply's model by the display name its provider's model list gives, in the line and in its not available form", () => {
    const settings = (requested: RequestedSettings, observed: ObservedSettings): Message => kind(new Provenance(null, requested, observed, null, false));
    const catalog = new ModelCatalog([new ProviderModel("gpt-6.1-sol", "GPT-6.1-Sol", "", [], true, null, true)], 1, false);
    const ran = settings(new RequestedSettings("codex", null, null), new ObservedSettings("codex", "gpt-6.1-sol", "high", null));
    const unavailable = settings(new RequestedSettings("codex", "gpt-6.1-sol", null), new ObservedSettings("codex", null, null, null, true));

    expect([formatter().modelLine(ran, [SampleData.codex], catalog), formatter().modelLine(ran, [SampleData.codex])]).toEqual(["GPT-6.1-Sol · high", "gpt-6.1-sol · high"]);
    expect(formatter().modelLine(unavailable, [SampleData.codex], catalog)).toBe("Default model, GPT-6.1-Sol not available");
  });

  it("names a teammate's effort as its provider's model list names it, and by its capitalised id without the list", () => {
    const catalog = new ModelCatalog([new ProviderModel("gpt-5", "gpt-5", "Fixture", ["high", "xhigh"], true, null, true, "high", { xhigh: "Extra high" })], 1, false);
    const teammate = new Teammate("t1", "Tess", null, "a1", Harness.Provider, "gpt-5", "xhigh", "t", "t");

    expect(formatter().teammateSummary(teammate, [SampleData.provider], [SampleData.codex], catalog)).toBe("Codex · Work · gpt-5 · Extra high");
    expect(formatter().teammateSummary(teammate, [SampleData.provider], [SampleData.codex])).toBe("Codex · Work · gpt-5 · Xhigh");
    expect(formatter().teammateSummary(teammate, [SampleData.provider], [SampleData.codex], catalog, new ChatThread("c1", "t1", 1, "codex", "a1", "gpt-other", "high")))
      .toBe("Codex · Work · gpt-other · High");
  });

  it("names a teammate's provider by its label beside its kind, so two providers of one kind read apart, and by the kind alone when the label is the kind's name", () => {
    const personal = new Provider("a3", "codex", "Personal", "/profiles/personal", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const named = new Provider("a4", "codex", "Codex", "/profiles/named", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const providers = [SampleData.provider, personal, named];
    const teammate = (provider: string): Teammate => new Teammate("t1", "Tess", null, provider, Harness.Provider, "gpt-5", null, "t", "t");

    expect(formatter().teammateSummary(teammate("a1"), providers, [SampleData.codex])).toBe(`Codex · Work · gpt-5 · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateSummary(teammate("a3"), providers, [SampleData.codex])).toBe(`Codex · Personal · gpt-5 · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateSummary(teammate("a4"), providers, [SampleData.codex])).toBe(`Codex · gpt-5 · ${Resources.modelDefaultEffort}`);
    expect(formatter().providerLine("codex", undefined, [SampleData.codex])).toBe("Codex");
  });

  it("names a teammate's model, or its provider's default model as its kind names it", () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const kinds = [SampleData.codex, copilot];
    const home = new Provider("a2", "copilot", "Home", "/profiles/copilot", AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp);
    const providers = [SampleData.provider, home];
    const teammate = (provider: string, model: string | null): Teammate => new Teammate("t1", "Tess", null, provider, Harness.Provider, model, null, "t", "t");

    expect(formatter().teammateSummary(teammate("a2", null), providers, kinds)).toBe(`GitHub Copilot · Home · Auto · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateSummary(teammate("a2", "gpt-5"), providers, kinds)).toBe(`GitHub Copilot · Home · gpt-5 · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateSummary(teammate("a1", null), providers, kinds)).toBe(`Codex · Work · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateSummary(teammate("gone", null), providers, kinds))
      .toBe(`${Resources.unavailableTeammateLabel} · ${Resources.providerDefaultModel} · ${Resources.modelDefaultEffort}`);
    expect(formatter().modelName(null, "copilot", kinds)).toBe("Auto");
    expect(formatter().modelName(null, null, kinds)).toBe(Resources.providerDefaultModel);
  });

  it("names a provider's default model from its kind first, then from the default its catalog lists", () => {
    const copilot = new ProviderKind("copilot", "GitHub Copilot", true, false, "Auto");
    const kinds = [SampleData.codex, copilot];

    expect(formatter().modelName(null, "codex", kinds, undefined, "GPT-5 Astra")).toBe("GPT-5 Astra");
    expect(formatter().modelName(null, "copilot", kinds, undefined, "GPT-5 Astra")).toBe("Auto");
    expect(formatter().modelName("gpt-5", "codex", kinds, undefined, "GPT-5 Astra")).toBe("gpt-5");
    expect(formatter().modelName(null, "codex", kinds, undefined, null)).toBe(Resources.providerDefaultModel);
  });

  it("names a listed model by its provider's display name, version dots kept, in a teammate's summary and its model column", () => {
    const catalog = new ModelCatalog([new ProviderModel("gpt-6.1-sol", "GPT-6.1-Sol", "", [], true, null, true)], 1, false);
    const teammate = new Teammate("t1", "Tess", null, "a1", Harness.Provider, "gpt-6.1-sol", null, "t", "t");

    expect(formatter().teammateSummary(teammate, [SampleData.provider], [SampleData.codex], catalog)).toBe(`Codex · Work · GPT-6.1-Sol · ${Resources.modelDefaultEffort}`);
    expect(formatter().teammateModel(teammate, [SampleData.provider], [SampleData.codex], catalog)).toBe("GPT-6.1-Sol");
    expect(formatter().teammateModel(teammate, [SampleData.provider], [SampleData.codex])).toBe("gpt-6.1-sol");
    expect(formatter().modelName("gpt-6.1-sol", "codex", [SampleData.codex], catalog)).toBe("GPT-6.1-Sol");
    expect(formatter().modelName(null, "codex", [SampleData.codex], catalog)).toBe(Resources.providerDefaultModel);
  });

  it("shows a plan's step in progress as running while its reply runs or asks, and as not done once the reply ends", () => {
    const plan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, "Fixing the bug"),
      new PlanStep("Run the tests", PlanStepStatus.Pending, null)], "First the code", "# Fix it", false, true).toJson();
    const shown = (status: MessageStatus): Message => reply([detail(0, DetailKind.Plan, "Plan", plan)], status);
    const steps = (value: ReplyPlan | null): unknown[][] => value?.steps.map(t => [t.text, t.status, t.activeText]) ?? [];

    for (const status of [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval])
      expect([status, steps(formatter().planOf(shown(status)))]).toEqual([status, [["Read the code", PlanStepStatus.Completed, null],
        ["Fix the bug", PlanStepStatus.InProgress, "Fixing the bug"], ["Run the tests", PlanStepStatus.Pending, null]]]);
    for (const status of [MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Cancelled, MessageStatus.Interrupted]) {
      const ended = formatter().planOf(shown(status));
      expect(ended).not.toBeNull();
      expect([status, steps(ended), ended?.explanation, ended?.text, ended?.approved, ended?.completedCount]).toEqual([status, [["Read the code", PlanStepStatus.Completed, null],
        ["Fix the bug", PlanStepStatus.Pending, null], ["Run the tests", PlanStepStatus.Pending, null]], "First the code", "# Fix it", true, 1]);
    }
  });

  describe("a sub-agent", () => {
    const agent = (status: SubAgentStatus, changes: Partial<Pick<SubAgent, "isBackground" | "toolUses" | "tokens" | "durationMs" | "summary">> = {}): JsonValue =>
      new SubAgent("ta", "Explore", "Explore the parser", "claude-haiku-5", status, changes.isBackground ?? false, changes.toolUses ?? null, changes.tokens ?? null,
        changes.durationMs ?? null, changes.summary ?? null).toJson();
    const nested = (sequence: number, kind: DetailKind, text: string, payload: JsonValue, parent: number = 0): MessageDetail =>
      new MessageDetail(sequence, kind, text, payload, SampleData.timestamp, parent);
    const callOf = (shown: Message, askers: ReadonlySet<string | null> | null = null): ToolCall =>
      formatter().callsOf(shown, formatter().activity(shown), null, false, false, askers)[0]!;

    it("is one step whose children are its own steps with their results, its plan apart and its usage and summary as its output, none of them the reply's", () => {
      const plan = new ReplyPlan([new PlanStep("Read the parser", PlanStepStatus.InProgress, "Reading the parser")], null, "# Its plan");
      const shown = reply([
        detail(0, DetailKind.SubAgent, "Explore the parser", agent(SubAgentStatus.Running, { toolUses: 3, tokens: 1200, summary: "Reading parser.ts" })),
        nested(1, DetailKind.Note, "Looking around", null),
        nested(2, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "tb" }),
        nested(3, DetailKind.Plan, "plan", plan.toJson()),
        nested(4, DetailKind.Note, "parser.ts", { toolUseId: "tb" }),
        detail(5, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "tc" }),
        nested(6, DetailKind.Note, "Grep: parse", { tool: "Grep", toolUseId: "td" })
      ], MessageStatus.Running);
      const call = callOf(shown);

      expect(formatter().segments(shown).map(t => [t.kind, t.entries.map(u => u.detail.sequence)])).toEqual([[SegmentKind.Activity, [0, 5]]]);
      expect([call.id, call.title, call.kind, call.status, call.output, call.hasOutputControl, call.startedAt?.getTime(), call.endedAt])
        .toEqual(["0", "Explore · Explore the parser", ToolCallKind.Other, ToolCallStatus.Running, "claude-haiku-5 · 3 tool uses · 1,200 tokens\nReading parser.ts", true,
          Date.parse(SampleData.timestamp), null]);
      expect(call.children.map(t => [t.id, t.title, t.status, t.output])).toEqual([
        ["1", "Looking around", ToolCallStatus.Succeeded, null], ["2", "> ls", ToolCallStatus.Succeeded, "parser.ts"], ["6", "Grep: parse", ToolCallStatus.Running, null]]);
      expect(formatter().subAgentPlanOf(shown, 0)?.steps.map(t => t.text)).toEqual(["Read the parser"]);
      expect(formatter().planOf(shown)).toBeNull();
      expect(formatter().activitySummary(formatter().activity(shown))).toBe(Resources.formatActivitySummary([Resources.formatCommandCount(1), Resources.formatOtherStepCount(1, false)]));
      expect(formatter().stepOf(formatter().activity(shown)[0]!, null).title).toBe("Explore the parser");
    });

    it("names its model in its usage by the display name of its reply's provider's model list", () => {
      const shown = reply([detail(0, DetailKind.SubAgent, "Explore the parser", agent(SubAgentStatus.Running, { toolUses: 3 }))], MessageStatus.Running);
      const catalog = new ModelCatalog([new ProviderModel("claude-haiku-5", "Haiku 5", "", [], false, null, true)], 1, false);

      expect(formatter().callsOf(shown, formatter().activity(shown), null, false, false, null, catalog)[0]?.output).toBe("Haiku 5 · 3 tool uses");
      expect(FormatterService.subAgentModel(new SubAgent("tb", null, "Plain", null, SubAgentStatus.Running, false), catalog)).toBeNull();
    });

    it("shows its plan's step in progress as running while it runs, whatever its reply's state, and as not done once it ends", () => {
      const plan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Completed, null), new PlanStep("Fix the bug", PlanStepStatus.InProgress, "Fixing the bug"),
        new PlanStep("Run the tests", PlanStepStatus.Pending, null)], null).toJson();
      const shown = (status: SubAgentStatus, replyStatus: MessageStatus): Message => reply([
        detail(0, DetailKind.SubAgent, "Explore the parser", agent(status, { isBackground: true })),
        nested(1, DetailKind.Plan, "Plan", plan)
      ], replyStatus);
      const statuses = (status: SubAgentStatus, replyStatus: MessageStatus): unknown[] =>
        [status, replyStatus, formatter().subAgentPlanOf(shown(status, replyStatus), 0)?.steps.map(t => [t.text, t.status, t.activeText])];
      const [done, running, pending] = [PlanStepStatus.Completed, PlanStepStatus.InProgress, PlanStepStatus.Pending].map(t => Resources.planStepStatuses[t]);

      for (const replyStatus of [MessageStatus.Running, MessageStatus.Completed, MessageStatus.Cancelled])
        expect(statuses(SubAgentStatus.Running, replyStatus)).toEqual([SubAgentStatus.Running, replyStatus,
          [["Read the code", done, null], ["Fix the bug", running, "Fixing the bug"], ["Run the tests", pending, null]]]);
      for (const status of [SubAgentStatus.Completed, SubAgentStatus.Failed, SubAgentStatus.Stopped])
        for (const replyStatus of [MessageStatus.Running, MessageStatus.AwaitingApproval, MessageStatus.Completed])
          expect(statuses(status, replyStatus)).toEqual([status, replyStatus, [["Read the code", done, null], ["Fix the bug", pending, null], ["Run the tests", pending, null]]]);
    });

    it("ends by its own state, timed by its usage, with its result as its text, or its summary when it ran in the background, and cuts off the steps it left open", () => {
      const ended = (status: SubAgentStatus, isBackground: boolean = false): ToolCall => callOf(reply([
        detail(0, DetailKind.SubAgent, "Explore the parser", agent(status, { isBackground, durationMs: 3000, summary: "Finished the scan" })),
        nested(1, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "tb" }),
        detail(2, DetailKind.Note, "Found it in parser.ts", { toolUseId: "ta" })
      ], MessageStatus.Running));
      const done = ended(SubAgentStatus.Completed);

      expect([done.status, done.duration, done.output, done.children.map(t => t.status)])
        .toEqual([ToolCallStatus.Succeeded, 3000, "claude-haiku-5\nFound it in parser.ts", [ToolCallStatus.Cancelled]]);
      expect([SubAgentStatus.Failed, SubAgentStatus.Stopped].map(t => ended(t).status)).toEqual([ToolCallStatus.Failed, ToolCallStatus.Cancelled]);
      expect(ended(SubAgentStatus.Completed, true).output).toBe("claude-haiku-5\nFinished the scan");
      expect(formatter().stepOf(formatter().activity(reply([detail(0, DetailKind.SubAgent, "Explore the parser", agent(SubAgentStatus.Failed))]))[0]!, null).isFailed).toBe(true);
    });

    it("shows no output when it has no model, usage or text, and reads as a plain step when its payload doesn't read", () => {
      const bare = new SubAgent(null, null, "Explore", null, SubAgentStatus.Running, false).toJson();
      const plain = callOf(reply([detail(0, DetailKind.SubAgent, "Explore", bare)], MessageStatus.Running));
      const one = callOf(reply([detail(0, DetailKind.SubAgent, "Explore", new SubAgent(null, "Explore", "Explore", null, SubAgentStatus.Running, false, 1).toJson())],
        MessageStatus.Running));
      const broken = callOf(reply([detail(0, DetailKind.SubAgent, "Explore", { status: 3 }), nested(1, DetailKind.Note, "Looking around", null)], MessageStatus.Completed));

      expect([plain.title, plain.output, plain.outputState, plain.hasOutputControl]).toEqual(["Explore", null, ToolCallOutputState.None, false]);
      expect([one.title, one.output]).toEqual(["Explore", "1 tool use"]);
      expect([broken.title, broken.children]).toEqual(["Explore", []]);
      expect(formatter().subAgentOf(detail(0, DetailKind.Note, "Explore", bare))).toBeNull();
    });

    it("waits for permission only in the sub-agent that asks, and the reply's own open step only when the reply asks", () => {
      const two = (name: string, sequence: number): MessageDetail[] => [
        detail(sequence, DetailKind.SubAgent, name, new SubAgent(`t${sequence}`, null, name, null, SubAgentStatus.Running, false).toJson()),
        nested(sequence + 1, DetailKind.Command, "> npm test", { tool: "Bash", toolUseId: `b${sequence}` }, sequence)];
      const shown = reply([...two("One", 0), ...two("Two", 2), detail(4, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "tm" })], MessageStatus.AwaitingApproval);
      const statusesOf = (askers: ReadonlySet<string | null> | null): ToolCallStatus[][] =>
        formatter().callsOf(shown, formatter().activity(shown), null, false, false, askers).map(t => [t.status, ...t.children.map(u => u.status)]);

      expect(statusesOf(new Set(["One"]))).toEqual([[ToolCallStatus.Running, ToolCallStatus.AwaitingPermission], [ToolCallStatus.Running, ToolCallStatus.Running],
        [ToolCallStatus.Running]]);
      expect(statusesOf(new Set([null]))).toEqual([[ToolCallStatus.Running, ToolCallStatus.Running], [ToolCallStatus.Running, ToolCallStatus.Running],
        [ToolCallStatus.AwaitingPermission]]);
      expect(statusesOf(null)).toEqual([[ToolCallStatus.Running, ToolCallStatus.AwaitingPermission], [ToolCallStatus.Running, ToolCallStatus.AwaitingPermission],
        [ToolCallStatus.AwaitingPermission]]);
    });

    it("notes \"waiting for your answer\" on the sub-agent's own step whose pending permission names its served call, and not on the sub-agent", () => {
      const click = (sequence: number, ref: string): MessageDetail => nested(sequence, DetailKind.Note, "mcp__teamrun__browser_click",
        { tool: "mcp__teamrun__browser_click", toolUseId: `tu-${ref}`, servedTool: "browser_click", servedInput: { ref } });
      const shown = reply([detail(0, DetailKind.SubAgent, "One", new SubAgent("t0", null, "One", null, SubAgentStatus.Running, false).toJson()), click(1, "e5"),
        click(2, "e7")], MessageStatus.AwaitingApproval);

      const [call] = formatter().callsOf(shown, formatter().activity(shown), null, false, false, null, undefined,
        [new PermissionPayload("browser", "p1", PermissionRisk.Medium, [], { tool: "browser_click", input: { ref: "e5" } })]);

      expect([call?.note, ...call?.children.map(t => t.note) ?? []]).toEqual([null, "waiting for your answer", null]);
    });

    it("waits in the sub-agent that asks, or the reply's open step, also once the reply has ended, but only while something still asks", () => {
      const agent = detail(0, DetailKind.SubAgent, "One", new SubAgent("t0", null, "One", null, SubAgentStatus.Running, true).toJson());
      const ended = reply([agent, nested(1, DetailKind.Command, "> npm test", { tool: "Bash", toolUseId: "b0" }, 0),
        detail(2, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "tm" })], MessageStatus.Completed);
      const running = reply(ended.details, MessageStatus.Running);
      const statusesOf = (shown: Message, askers: ReadonlySet<string | null> | null, isAsking: boolean = false): ToolCallStatus[][] =>
        formatter().callsOf(shown, formatter().activity(shown), null, false, isAsking, askers).map(t => [t.status, ...t.children.map(u => u.status)]);

      expect(statusesOf(ended, new Set(["One"]), true)[0]).toEqual([ToolCallStatus.Running, ToolCallStatus.AwaitingAnswer]);
      expect(statusesOf(ended, new Set([null]))[1]).toEqual([ToolCallStatus.AwaitingPermission]);
      expect(statusesOf(ended, null)[0]).toEqual([ToolCallStatus.Running, ToolCallStatus.Running]);
      expect(statusesOf(running, new Set(["One"]))[0]).toEqual([ToolCallStatus.Running, ToolCallStatus.Running]);
      expect([formatter().waitsOn(ended, new Set()), formatter().waitsOn(ended, null), formatter().waitsOn(running, new Set([null]))]).toEqual([true, false, false]);
    });

    it("nests a sub-agent that one of its own steps starts", () => {
      const shown = reply([
        detail(0, DetailKind.SubAgent, "Explore the parser", agent(SubAgentStatus.Running)),
        nested(1, DetailKind.SubAgent, "Read the tests", new SubAgent("tn", null, "Read the tests", null, SubAgentStatus.Completed, false).toJson()),
        nested(2, DetailKind.Note, "Read: a.test.ts", { tool: "Read", toolUseId: "tr" }, 1)
      ], MessageStatus.Running);

      expect(callOf(shown).children.map(t => [t.title, t.status, t.children.map(u => [u.title, u.status])]))
        .toEqual([["Read the tests", ToolCallStatus.Succeeded, [["Read: a.test.ts", ToolCallStatus.Cancelled]]]]);
    });
  });
});
