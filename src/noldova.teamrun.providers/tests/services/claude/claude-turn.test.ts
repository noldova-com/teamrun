/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources as CoreResources, TurnOutcome } from "@noldova/teamrun.core";
import { ApprovalKind, DetailKind, QuestionAnswer, ReplyPlan, SubAgent } from "@noldova/teamrun.protocol";
import { ClaudeTurn, DeltaStream, Resources } from "@noldova/teamrun.providers";

import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { TurnFeed } from "../../fixtures/turn-feed.fixture.js";

@TestClass
export class ClaudeTurnTests {
  private static readonly questions: Record<string, unknown> = {
    questions: [
      { question: "Which platform?", header: "Platform", options: [{ label: "Desktop app", description: "The window" }, { label: "Web", description: "A browser" }], multiSelect: false },
      { question: "Which parts?", header: "Parts", options: [{ label: "Attachments", description: "Files" }, { label: "Slash commands", description: "Commands" }], multiSelect: true }
    ]
  };

  @TestMethod
  public async endsWithoutWaitingForAPlanUseReadClaudeLeavesOpenAndReportsOneThatCameInTime(): Promise<void> {
    const hung = new RecordingTurnListener();
    const hanging = new FakeClaudeQuery([SdkMessages.init("s-90", "none", null, []), SdkMessages.success("s-90", "Done")]);
    hanging.planUsageHang = true;
    const read = new RecordingTurnListener();
    const reading = new FakeClaudeQuery([SdkMessages.init("s-91", "none", null, []), SdkMessages.success("s-91", "Done")]);
    reading.planUsageResult = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 20, resets_at: "2026-10-22T15:00:00Z" } } };
    const hour = 3_600_000;
    const ended = new ClaudeTurn(hung, null, new DeltaStream(hung, 1), null, undefined, hour);

    await TurnFeed.consume(ended, hanging);
    await TurnFeed.consume(new ClaudeTurn(read, null, new DeltaStream(read, 1), null, undefined, hour), reading);

    Assert.areEqual(TurnOutcome.Completed, ended.outcome);
    Assert.areEqual(0, hung.planUsages.length);
    Assert.areEqual("FiveHour 20", read.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent}`).join(";")).join(","));
  }

  @TestMethod
  public async endsATurnWhoseListenerFailsToTakeThePlanUse(): Promise<void> {
    const listener = new RecordingTurnListener();
    let offered = 0;
    listener.onPlanUsageAsync = () => {
      offered += 1;
      return Promise.reject(new Error("The plan use wasn't kept"));
    };
    const query = new FakeClaudeQuery([SdkMessages.init("s-92", "none", null, []), SdkMessages.success("s-92", "Done")]);
    query.planUsageResult = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 20, resets_at: "2026-10-22T15:00:00Z" } } };
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    await TurnFeed.consume(turn, query);

    Assert.areEqual(1, offered);
    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(0, listener.planUsages.length);
  }

  @TestMethod
  public async replacesEachStreamedBlockWhenTheBlocksArriveOneMessageAtATime(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const first = "33333333-3333-3333-3333-333333333333";
    const second = "44444444-4444-4444-4444-444444444444";
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-3", "none", null, []),
      SdkMessages.messageStart("s-3", first),
      SdkMessages.thinkingDelta("s-3", first, 0, "Pond"),
      SdkMessages.blockStop("s-3", first, 0),
      SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.thinking("Pondering")], "claude-opus-5"),
      SdkMessages.textDelta("s-3", first, 1, "Hel"),
      SdkMessages.textDelta("s-3", first, 1, "lo"),
      SdkMessages.blockStop("s-3", first, 1),
      SdkMessages.assistant("66666666-6666-6666-6666-666666666666", [SdkMessages.text("Hello!")], "claude-opus-5"),
      SdkMessages.assistant("77777777-7777-7777-7777-777777777777", [SdkMessages.toolUse("tool-1", "Bash", { command: "ls" })], "claude-opus-5"),
      SdkMessages.messageStart("s-3", second),
      SdkMessages.textDelta("s-3", second, 0, "Do"),
      SdkMessages.assistant("88888888-8888-8888-8888-888888888888", [SdkMessages.text("Done.")], "claude-opus-5"),
      SdkMessages.success("s-3", "Done.")
    ]);

    await TurnFeed.consume(turn, query);

    const texts = listener.details.filter(t => t.kind === DetailKind.Text);
    Assert.areEqual(JSON.stringify(["s-3:stream1:1", "s-3:stream2:0"]), JSON.stringify([...new Set(texts.map(t => t.providerItemId))]));
    Assert.areEqual("Hello!", texts.filter(t => t.providerItemId === "s-3:stream1:1").at(-1)?.text);
    Assert.areEqual("Done.", texts.at(-1)?.text);
    Assert.areEqual("Pondering", listener.details.filter(t => t.providerItemId === "s-3:stream1:0").at(-1)?.text);
  }

  @TestMethod
  public async growsStreamedBlocksThenReusesTheirIdsForTheCompleteMessage(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const uuid = "22222222-2222-2222-2222-222222222222";
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-2", "none", null, []),
      SdkMessages.messageStart("s-2", uuid),
      SdkMessages.thinkingDelta("s-2", uuid, 0, "Pond"),
      SdkMessages.textDelta("s-2", uuid, 1, "Hel"),
      SdkMessages.textDelta("s-2", uuid, 1, "lo"),
      SdkMessages.otherDelta("s-2", uuid, 2),
      SdkMessages.blockStop("s-2", uuid, 1),
      SdkMessages.textDelta("s-2", uuid, 1, " ignored", "parent-tool"),
      SdkMessages.assistant(uuid, [SdkMessages.thinking("Pondering"), SdkMessages.text("Hello!")], "claude-opus-5"),
      SdkMessages.success("s-2", "Hello!")
    ]);

    await TurnFeed.consume(turn, query);

    const texts = listener.details.filter(t => t.providerItemId === "s-2:stream1:1");
    Assert.isTrue(texts.length >= 2, String(texts.length));
    Assert.areEqual("Hello!", texts[texts.length - 1]?.text);
    Assert.areEqual("Hello", texts[texts.length - 2]?.text);
    const reasoning = listener.details.filter(t => t.providerItemId === "s-2:stream1:0");
    Assert.areEqual("Pondering", reasoning[reasoning.length - 1]?.text);
    Assert.isFalse(listener.details.some(t => t.text.includes("ignored")));
    Assert.areEqual(TurnOutcome.Completed, turn.toResult().outcome);
  }

  @TestMethod
  public async reportsTheSessionBlocksAndResult(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [
        SdkMessages.text("Hello"),
        SdkMessages.text("  "),
        SdkMessages.thinking("Pondering"),
        SdkMessages.thinking(""),
        SdkMessages.toolUse("tu-1", "Bash", { command: "ls -la" }),
        SdkMessages.toolUse("tu-2", "Edit", { file_path: "a.ts", old: "x" }),
        SdkMessages.toolUse("tu-3", "Read", { a: 1, b: 2, c: 3, d: 4, e: 5 }),
        SdkMessages.toolUse("tu-4", "Glob", {}),
        SdkMessages.toolUse("tu-5", "Custom", "raw")
      ], "claude-sonnet-5"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("child")], "claude-sonnet-5", "tu-1"),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("switched")], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [
        SdkMessages.toolResult("tu-1", "l\0i\0s\0t\0i\0n\0g\0"),
        SdkMessages.toolResult("tu-2", [SdkMessages.textParam("part one"), SdkMessages.imageParam(), SdkMessages.textParam("part two")], true),
        SdkMessages.toolResult("tu-3", undefined),
        SdkMessages.toolResult("tu-4", "   ", true),
        SdkMessages.textParam("plain user text")
      ]),
      SdkMessages.user("55555555-5555-5555-5555-555555555555", "typed by hand"),
      SdkMessages.user("66666666-6666-6666-6666-666666666666", [SdkMessages.toolResult("tu-9", "child result")], "tu-1"),
      SdkMessages.user(undefined, "no entry id"),
      SdkMessages.status("s-1"),
      SdkMessages.thinkingTokens("s-1", 20),
      SdkMessages.thinkingTokens("s-1", 40),
      SdkMessages.success("s-1", "All done")
    ]);
    query.accountInfoResult = { email: "a@b.c", organization: "Org", subscriptionType: "max" };

    await TurnFeed.consume(turn, query);
    const result = turn.toResult();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("s-1", result.nativeSessionId);
    Assert.areEqual("55555555-5555-5555-5555-555555555555", result.nativeTurnId);
    Assert.areEqual("claude-opus-5", turn.observed.model);
    Assert.areEqual("claude-opus-5", result.observed.model);
    Assert.areEqual("high", result.observed.effort);
    Assert.areEqual("2.1.263", result.observed.harnessVersion);
    Assert.areEqual(0, query.accountInfoReads);
    Assert.isFalse(Object.hasOwn(result.observed.toJson(), "identity"));
    Assert.isFalse(JSON.stringify(listener.observations.map(t => t.toJson())).includes("a@b.c"));
    Assert.areEqual("s-1", listener.starts[0]?.nativeSessionId);
    Assert.isTrue(listener.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(2, listener.observations.length);
    Assert.areEqual(2, listener.thinking);
    const expectedTexts = [
      "Hello", "Pondering", "Bash: ls -la", "Edit: a.ts", "Read (a, b, c, d)",
      "Glob", "Custom", "switched", "listing", "part one\n\npart two", "", ""
    ];
    Assert.areEqual(expectedTexts.join("|"), listener.texts.join("|"));
    Assert.areEqual(DetailKind.Reasoning, listener.details[1]?.kind);
    Assert.areEqual(DetailKind.Command, listener.details[2]?.kind);
    Assert.areEqual("11111111-1111-1111-1111-111111111111:4", listener.details[2]?.providerItemId);
    Assert.areEqual("{\"tool\":\"Bash\",\"input\":{\"command\":\"ls -la\"},\"toolUseId\":\"tu-1\",\"title\":\"Listed the folder\",\"writes\":[],"
      + "\"unnamedWrites\":[]}", JSON.stringify(listener.details[2]?.payload));
    Assert.areEqual(DetailKind.FileChange, listener.details[3]?.kind);
    Assert.areEqual(DetailKind.Note, listener.details[4]?.kind);
    Assert.areEqual("{\"toolUseId\":\"tu-1\",\"isError\":false}", JSON.stringify(listener.details[8]?.payload));
    Assert.areEqual("{\"toolUseId\":\"tu-2\",\"isError\":true}", JSON.stringify(listener.details[9]?.payload));
    Assert.areEqual("44444444-4444-4444-4444-444444444444:1", listener.details[9]?.providerItemId);
    Assert.areEqual("{\"toolUseId\":\"tu-3\",\"isError\":false}", JSON.stringify(listener.details[10]?.payload));
    Assert.areEqual("{\"toolUseId\":\"tu-4\",\"isError\":true}", JSON.stringify(listener.details[11]?.payload));
  }

  @TestMethod
  public async titlesACommandByItsDescriptionElseByItsShellsRules(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [
        SdkMessages.toolUse("tu-1", "Bash", { command: "rg -n foo src", description: "  Find foo  " }),
        SdkMessages.toolUse("tu-2", "Bash", { command: "rg -n foo src", description: " " }),
        SdkMessages.toolUse("tu-3", "PowerShell", { command: "Get-Content a.ts" }),
        SdkMessages.toolUse("tu-4", "Bash", { command: "Get-Content a.ts" }),
        SdkMessages.toolUse("tu-5", "Bash", { command: "npm test", description: 3 })
      ], "claude-sonnet-5"),
      SdkMessages.success("s-1", "All done")
    ]);

    await TurnFeed.consume(turn, query);

    const titles = listener.details.filter(t => t.kind === DetailKind.Command).map(t => (t.payload as { title?: string } | null)?.title ?? "-");
    Assert.areEqual("Find foo|Searched for foo in src|Read a.ts|-|-", titles.join("|"));
  }

  @TestMethod
  public async namesTheFilesACommandWritesInItsToolsShell(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [
        SdkMessages.toolUse("tu-1", "Bash", { command: "cd /tmp && echo hi > a.txt && python gen.py" }),
        SdkMessages.toolUse("tu-2", "PowerShell", { command: "'hi' | Set-Content C:\\t\\b.txt" }),
        SdkMessages.toolUse("tu-3", "Bash", { command: "echo 'open" })
      ], "claude-sonnet-5"),
      SdkMessages.success("s-1", "All done")
    ]);

    await TurnFeed.consume(turn, query);

    const writes = listener.details.filter(t => t.kind === DetailKind.Command).map(t => {
      const payload = t.payload as { writes?: string[]; unnamedWrites?: string[] } | null;
      return `${payload?.writes?.join(",") ?? "-"}:${payload?.unnamedWrites?.join(",") ?? "-"}`;
    });
    Assert.areEqual("/tmp/a.txt:/tmp|C:\\t\\b.txt:|-:-", writes.join("|"));
  }

  @TestMethod
  public async showsACompactionAfterTheTextBeforeItAndFailsATurnWhosePromptNoLongerFits(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 60_000));
    const errorListener = new RecordingTurnListener();
    const errorTurn = new ClaudeTurn(errorListener, null, new DeltaStream(errorListener, 60_000));
    const message = "99999999-9999-9999-9999-999999999999";
    const boundary = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    await TurnFeed.consume(turn, new FakeClaudeQuery([
      SdkMessages.init("s-5", "none", null, []),
      SdkMessages.messageStart("s-5", message),
      SdkMessages.textDelta("s-5", message, 0, "Before"),
      SdkMessages.compactBoundary("s-5", boundary),
      SdkMessages.promptTooLong("s-5", false)
    ]));
    await TurnFeed.consume(errorTurn, new FakeClaudeQuery([SdkMessages.promptTooLong("s-6", true)]));
    const shown = listener.details.filter(t => t.kind !== DetailKind.Note || t.providerItemId === boundary);

    Assert.areEqual(JSON.stringify(["Before", "Claude Code compacted its context."]), JSON.stringify(shown.slice(-2).map(t => t.text)));
    Assert.areEqual(DetailKind.Note, shown.at(-1)?.kind);
    Assert.areEqual(JSON.stringify({ [CoreResources.compactionField]: true }), JSON.stringify(shown.at(-1)?.payload));
    Assert.areEqual(TurnOutcome.Failed, turn.toResult().outcome);
    Assert.areEqual("Claude Code's context is full. Send /compact to compact it, then retry.", turn.toResult().error);
    Assert.areEqual("s-5", turn.toResult().nativeSessionId);
    Assert.areEqual("Claude Code's context is full. Send /compact to compact it, then retry.", errorTurn.toResult().error);
  }

  @TestMethod
  public async takesTheEffortFromClaudeCodesAppliedSettingsOnlyWhenTheInitMessageNamesNone(): Promise<void> {
    const run = async (reported: EffortLevel | null, settings: { applied?: { effort?: unknown } }, failure: Error | null = null, thrown: Error | null = null): Promise<[string | null, number]> => {
      const listener = new RecordingTurnListener();
      const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
      const query = new FakeClaudeQuery([SdkMessages.init("s-6", "none", reported, []), SdkMessages.success("s-6", "ok")]);
      query.settingsResult = settings;
      query.settingsFailure = failure;
      query.settingsThrow = thrown;
      await TurnFeed.consume(turn, query);
      Assert.areEqual(TurnOutcome.Completed, turn.toResult().outcome);
      return [turn.toResult().observed.effort, query.settingsCount];
    };

    Assert.areEqual(JSON.stringify(["xhigh", 1]), JSON.stringify(await run(null, { applied: { effort: "xhigh" } })));
    Assert.areEqual(JSON.stringify(["high", 0]), JSON.stringify(await run("high", { applied: { effort: "low" } })));
    Assert.areEqual(JSON.stringify([null, 1]), JSON.stringify(await run(null, { applied: { effort: 3 } })));
    Assert.areEqual(JSON.stringify([null, 1]), JSON.stringify(await run(null, {})));
    Assert.areEqual(JSON.stringify([null, 1]), JSON.stringify(await run(null, { applied: { effort: "high" } }, new Error("unsupported"))));
    Assert.areEqual(JSON.stringify([null, 1]), JSON.stringify(await run(null, { applied: { effort: "high" } }, null, new Error("not a function"))));
  }

  @TestMethod
  public async runsOnAnApiKeyWithoutReadingTheAccountOrASessionNote(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-2", "user", null, [{ name: "srv", status: "connected" }, { name: "other", status: "failed" }]),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tu-1", "no uuid")]),
      SdkMessages.failure("s-2", "error_max_turns", ["a", "b"])
    ]);
    query.accountInfoFailure = new Error("nope");

    await TurnFeed.consume(turn, query);
    const result = turn.toResult();

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("error_max_turns: a; b", result.error);
    Assert.isNull(result.observed.effort);
    Assert.areEqual(0, query.accountInfoReads);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual(JSON.stringify(["no uuid"]), JSON.stringify(listener.texts));
    Assert.isNull(listener.details[0]?.providerItemId);
  }

  @TestMethod
  public async handlesInterruptionsAndMissingResults(): Promise<void> {
    const silentListener = new RecordingTurnListener();
    const silent = new ClaudeTurn(silentListener, null, new DeltaStream(silentListener, 1));
    const interruptedListener = new RecordingTurnListener();
    const interrupted = new ClaudeTurn(interruptedListener, null, new DeltaStream(interruptedListener, 1));
    const explicitListener = new RecordingTurnListener();
    const explicit = new ClaudeTurn(explicitListener, null, new DeltaStream(explicitListener, 1));
    const untouchedListener = new RecordingTurnListener();
    const untouched = new ClaudeTurn(untouchedListener, null, new DeltaStream(untouchedListener, 1));

    await TurnFeed.consume(silent, new FakeClaudeQuery([SdkMessages.init("s-3", "none", null, [])]));
    interrupted.markInterrupted();
    await TurnFeed.consume(interrupted, new FakeClaudeQuery([SdkMessages.failure("s-4", "error_during_execution", [])]));
    interrupted.fail("ignored");
    explicit.fail("exploded");

    Assert.areEqual(TurnOutcome.Failed, silent.outcome);
    Assert.areEqual("Claude Code ended without a result message.", silent.toResult().error);
    Assert.isNull(silent.toResult().nativeTurnId);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.outcome);
    Assert.isTrue(interrupted.isInterrupted);
    Assert.isNull(interrupted.toResult().error);
    Assert.areEqual(0, interruptedListener.details.length);
    Assert.areEqual("exploded", explicit.toResult().error);
    Assert.areEqual(TurnOutcome.Failed, untouched.toResult().outcome);
    Assert.areEqual("Claude Code ended without a result message.", untouched.toResult().error);
    Assert.isNull(untouched.sessionId);
  }

  @TestMethod
  public async showsExitPlanModesPlanAsTheReplysPlanTextNeverAsAStepAndMarksItApprovedAndLeavesPlanOnlyWhenThePersonAllowedItAndItRan(): Promise<void> {
    const listener = new RecordingTurnListener();
    let left = 0;
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, undefined, undefined, undefined, undefined, () => {
      left += 1;
      return Promise.resolve();
    });
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Move the cache\n1. Read it" })],
        "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "The user doesn't want to proceed with this tool use.", true)]),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "ExitPlanMode", { plan: "## Move the cache, then test" }),
        SdkMessages.toolUse("tu-3", "ExitPlanMode", { plan: " " })], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "User has approved your plan.")]),
      SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.toolUse("tu-4", "ExitPlanMode", { plan: "# Skip asking" })], "claude-opus-5"),
      SdkMessages.user("66666666-6666-6666-6666-666666666666", [SdkMessages.toolResult("tu-4", "User has approved your plan.")]),
      SdkMessages.success("s-8", "Done.")
    ]);
    listener.defaultDecision = "allow";

    const asked = await turn.decide("ExitPlanMode", { plan: "## Move the cache, then test" }, new AbortController().signal, "tu-2");
    await TurnFeed.consume(turn, query);

    const plans = listener.details.filter(t => t.kind === DetailKind.Plan);
    Assert.areEqual("Move the cache|# Move the cache\n1. Read it|false,Move the cache, then test|## Move the cache, then test|false,"
      + "Move the cache, then test|## Move the cache, then test|true,Skip asking|# Skip asking|false",
      plans.map(t => `${t.text}|${ReplyPlan.fromJson(t.payload).text}|${ReplyPlan.fromJson(t.payload).approved}`).join(","));
    Assert.isTrue(plans.every(t => t.providerItemId === Resources.planTextDetailId));
    Assert.isFalse(listener.details.some(t => /"toolUseId":"tu-\d"/u.test(JSON.stringify(t.payload))));
    Assert.areEqual("allow:1:ExitPlanMode", `${asked.behavior}:${listener.asks.length}:${listener.asks[0]?.nativeKind}`);
    Assert.areEqual(1, left);
  }

  @TestMethod
  public async notesThatClaudeCodeKeptItsPlanModeWhenLeavingItFailsAfterThePersonApprovedThePlan(): Promise<void> {
    const listener = new RecordingTurnListener();
    let failure: Promise<void> = Promise.resolve();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, undefined, undefined, undefined, undefined,
      () => failure = Promise.reject(new Error("Claude Code isn't reading input.")));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Move the cache" })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-8", "Done.")
    ]);
    listener.defaultDecision = "allow";

    await turn.decide("ExitPlanMode", { plan: "# Move the cache" }, new AbortController().signal, "tu-1");
    await TurnFeed.consume(turn, query);
    await failure.catch(() => undefined);

    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Plan && ReplyPlan.fromJson(t.payload).approved));
    Assert.areEqual("Claude Code couldn't leave its plan mode once the plan was approved: Claude Code isn't reading input.",
      listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async notesThatClaudeCodeKeptItsPlanModeWhenLeavingItDoesntAnswerWithinTheRequestTime(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, undefined, 5, undefined, undefined, () => new Promise<void>(() => undefined));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Move the cache" })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-8", "Done.")
    ]);
    listener.defaultDecision = "allow";

    await turn.decide("ExitPlanMode", { plan: "# Move the cache" }, new AbortController().signal, "tu-1");
    await TurnFeed.consume(turn, query);

    Assert.areEqual("Claude Code couldn't leave its plan mode once the plan was approved: it didn't answer within 0.005 s.",
      listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async sendsExitPlanModesPlanAgainAsRefusedOnlyWhenThePersonDeniesIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-9", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Move the cache" })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Denied by the TeamRun user.", true)]),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "ExitPlanMode", { plan: "# Move it later" })], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "The tool failed.", true)]),
      SdkMessages.success("s-9", "Done.")
    ]);
    listener.decisions.push("deny", "cancel");

    const denied = await turn.decide("ExitPlanMode", { plan: "# Move the cache" }, new AbortController().signal, "tu-1");
    const cancelled = await turn.decide("ExitPlanMode", { plan: "# Move it later" }, new AbortController().signal, "tu-2");
    await TurnFeed.consume(turn, query);

    const plans = listener.details.filter(t => t.kind === DetailKind.Plan).map(t => ReplyPlan.fromJson(t.payload));
    Assert.areEqual("deny:deny", `${denied.behavior}:${cancelled.behavior}`);
    Assert.areEqual("Move the cache:false,Move the cache:true,Move it later:false", plans.map(t => `${t.title}:${t.rejected}`).join(","));
    Assert.isFalse(plans.some(t => t.approved));
    Assert.isTrue(listener.details.filter(t => t.kind === DetailKind.Plan).every(t => t.providerItemId === Resources.planTextDetailId));
  }

  @TestMethod
  public async showsTheToDoToolsAsTheReplysPlanNeverAsStepsAndAllowsThemWithoutAsking(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const created = SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Task #1 created successfully: Fix the bug")]);
    created.tool_use_result = { task: { id: "1", subject: "Fix the bug" } };
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-7", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "TaskCreate", { subject: "Fix the bug", activeForm: "Fixing the bug" })],
        "claude-opus-5"),
      created,
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "TaskUpdate", { taskId: "1", status: "in_progress" }),
        SdkMessages.toolUse("tu-3", "Bash", { command: "ls" })], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "Updated task #1 status"), SdkMessages.toolResult("tu-3", "a.ts")]),
      SdkMessages.success("s-7", "Done.")
    ]);

    await TurnFeed.consume(turn, query);
    const allowed = await turn.decide("TaskUpdate", { taskId: "1", status: "completed" }, new AbortController().signal, "tu-4");

    const plans = listener.details.filter(t => t.kind === DetailKind.Plan);
    Assert.areEqual("Plan, 0 of 1 done,Plan, 0 of 1 done", plans.map(t => t.text).join(","));
    Assert.areEqual("InProgress:Fixing the bug", plans.map(t => ReplyPlan.fromJson(t.payload).steps.map(u => `${u.status}:${String(u.activeText)}`).join()).at(-1));
    Assert.isTrue(plans.every(t => t.providerItemId === Resources.planDetailId));
    Assert.areEqual("tu-3,tu-3", listener.details.map(t => JSON.stringify(t.payload).match(/"toolUseId":"(tu-\d)"/)?.[1]).filter(t => t !== undefined).join(","));
    Assert.areEqual("allow:0", `${allowed.behavior}:${listener.asks.length}`);
  }

  @TestMethod
  public async showsTerminalsRunAndWriteCallsAsCommandStepsSentAgainWithTheirResult(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("deny");
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const ran = SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "ok\n\n\n[Status: Exited. Exit code: 0.]")]);
    ran.tool_use_result = { content: [{ type: "text", text: "ok" }],
      structuredContent: { terminal_id: "t1", title: "bash - project", status: "Exited", exit_code: 0, output: "ok\n" } };
    const refused = SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "Denied by the TeamRun user.", true),
      SdkMessages.toolResult("tu-3", "[]")]);
    refused.tool_use_result = [{ type: "text", text: "Denied by the TeamRun user." }];
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "mcp__teamrun__terminal_run",
        { terminal_id: "t1", command: "npm test" })], "claude-opus-5"),
      ran,
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "mcp__teamrun__terminal_write", { terminal_id: "t1", keys: "y\r" }),
        SdkMessages.toolUse("tu-3", "mcp__teamrun__terminal_list", {})], "claude-opus-5"),
      refused,
      SdkMessages.success("s-8", "Done.")
    ]);

    await turn.decide("mcp__teamrun__terminal_write", { terminal_id: "t1", keys: "y\r" }, new AbortController().signal, "tu-2");
    await TurnFeed.consume(turn, query);

    const run = listener.details.filter(t => t.providerItemId === "11111111-1111-1111-1111-111111111111:0");
    const write = listener.details.filter(t => t.providerItemId === "33333333-3333-3333-3333-333333333333:0");
    Assert.areEqual("Command:Run in a terminal:inProgress,Command:Run in bash - project:completed",
      run.map(t => `${t.kind}:${String((t.payload as Record<string, unknown>)["title"])}:${String((t.payload as Record<string, unknown>)["status"])}`).join(","));
    Assert.areEqual("$ npm test\nok\n\n(exit 0)", run.at(-1)?.text);
    Assert.areEqual(JSON.stringify({ toolUseId: "tu-2", denied: true, tool: "terminal_write", command: "y\\r", terminalId: "t1", terminalTitle: null,
      exitCode: null, status: "failed", title: "Sent keys to a terminal" }), JSON.stringify(write.at(-1)?.payload));
    Assert.areEqual("$ y\\r\nDenied by the TeamRun user.", write.at(-1)?.text);
    Assert.areEqual(DetailKind.Note, listener.details.find(t => t.providerItemId === "33333333-3333-3333-3333-333333333333:1")?.kind);
    Assert.areEqual(JSON.stringify({ tool: "mcp__teamrun__terminal_list", input: {}, toolUseId: "tu-3", servedTool: "terminal_list", servedInput: {} }),
      JSON.stringify(listener.details.find(t => t.providerItemId === "33333333-3333-3333-3333-333333333333:1")?.payload));
    Assert.areEqual(1, listener.details.filter(t => JSON.stringify(t.payload).includes("\"toolUseId\":\"tu-3\"") && t.text === "[]").length);
    Assert.isFalse(listener.details.some(t => JSON.stringify(t.payload).includes("\"toolUseId\":\"tu-1\"") && t.kind === DetailKind.Note));
  }

  @TestMethod
  public async decidesToolUseThroughTheListener(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "deny");
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    const allowed = await turn.decide("Bash", { command: "ls" }, new AbortController().signal, "tu-1");
    const denied = await turn.decide("Write", { file_path: "a.ts" }, new AbortController().signal, "tu-2");
    const tool = await turn.decide("WebFetch", {}, new AbortController().signal, "tu-3");

    Assert.areEqual("allow", allowed.behavior);
    Assert.areEqual("{\"command\":\"ls\"}", JSON.stringify(allowed.behavior === "allow" ? allowed.updatedInput : null));
    Assert.areEqual("deny", denied.behavior);
    Assert.areEqual("Denied by the TeamRun user.", denied.behavior === "deny" ? denied.message : null);
    Assert.areEqual("deny", tool.behavior);
    Assert.areEqual("pending:1,pending:2,pending:3", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("Bash", listener.asks[0]?.nativeKind);
    Assert.areEqual("Bash: ls", listener.asks[0]?.summary);
    Assert.areEqual("{\"tool\":\"Bash\",\"input\":{\"command\":\"ls\"}}", JSON.stringify(listener.asks[0]?.payload));
    Assert.areEqual(ApprovalKind.FileChange, listener.asks[1]?.kind);
    Assert.areEqual(ApprovalKind.Tool, listener.asks[2]?.kind);
    Assert.areEqual("WebFetch", listener.asks[2]?.summary);
    Assert.areEqual("allow:Approved:Once,deny:Denied:Once", listener.asks[0]?.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
  }

  @TestMethod
  public async asksAskUserQuestionAsQuestionsAndAllowsItWithTheAnswersByQuestion(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("Which platform?", ["Desktop app"], null), new QuestionAnswer("Which parts?", ["Attachments", "Slash commands"], "Themes")]);
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const signal = new AbortController().signal;

    const answered = await turn.decide("AskUserQuestion", ClaudeTurnTests.questions, signal, "tu-q");

    Assert.areEqual("allow", answered.behavior);
    Assert.areEqual(JSON.stringify({ ...ClaudeTurnTests.questions, answers: { "Which platform?": "Desktop app", "Which parts?": "Attachments, Slash commands, Themes" } }),
      JSON.stringify(answered.behavior === "allow" ? answered.updatedInput : null));
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual("pending:1", listener.questionAsks[0]?.providerRequestId);
    Assert.areEqual("AskUserQuestion", listener.questionAsks[0]?.nativeKind);
    Assert.isTrue(listener.signals[0] === signal);
    Assert.areEqual(JSON.stringify([
      { id: "Which platform?", header: "Platform", text: "Which platform?", options: [{ label: "Desktop app", description: "The window" }, { label: "Web", description: "A browser" }],
        multiple: false, other: true, secret: false },
      { id: "Which parts?", header: "Parts", text: "Which parts?", options: [{ label: "Attachments", description: "Files" }, { label: "Slash commands", description: "Commands" }],
        multiple: true, other: true, secret: false }
    ]), JSON.stringify(listener.questionAsks[0]?.questions.map(t => t.toJson())));
    Assert.isNull(listener.questionAsks[0]?.subAgent);
  }

  @TestMethod
  public async namesTheSubAgentThatAsksAskUserQuestionOnItsQuestions(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("Which platform?", ["Web"], null), new QuestionAnswer("Which parts?", ["Attachments"], null)]);
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    const answered = await turn.decide("AskUserQuestion", ClaudeTurnTests.questions, new AbortController().signal, "tu-q", "Explore the parser");

    Assert.areEqual("allow", answered.behavior);
    Assert.areEqual("Explore the parser", listener.questionAsks.map(t => t.subAgent).join(","));
    Assert.areEqual(0, listener.asks.length);
  }

  @TestMethod
  public async deniesAskUserQuestionWhenItsQuestionsAreSkippedOrCantBeRead(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    const skipped = await turn.decide("AskUserQuestion", ClaudeTurnTests.questions, new AbortController().signal, "tu-q");
    const unreadable = await turn.decide("AskUserQuestion", { questions: [{ question: "Which?", header: "Pick", options: [{ label: "A", description: "" }, { label: "A", description: "" }],
      multiSelect: false }] }, new AbortController().signal, "tu-q");
    const missing = await turn.decide("AskUserQuestion", {}, new AbortController().signal, "tu-q");

    Assert.areEqual("The TeamRun user skipped these questions.", skipped.behavior === "deny" ? skipped.message : null);
    Assert.areEqual("TeamRun couldn't show these questions to its user.", unreadable.behavior === "deny" ? unreadable.message : null);
    Assert.areEqual("TeamRun couldn't show these questions to its user.", missing.behavior === "deny" ? missing.message : null);
    Assert.areEqual(1, listener.questionAsks.length);
    Assert.areEqual(0, listener.asks.length);
  }

  @TestMethod
  public async deniesAskUserQuestionAsNotAnsweredWhenTheReplyStopsWhileItWaits(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("Message m2 is not open.");
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    const stopped = await turn.decide("AskUserQuestion", ClaudeTurnTests.questions, new AbortController().signal, "tu-q");

    Assert.areEqual("deny", stopped.behavior);
    Assert.areEqual("The TeamRun user didn't answer these questions.", stopped.behavior === "deny" ? stopped.message : null);
    Assert.areEqual(1, listener.questionAsks.length);
  }

  @TestMethod
  public async marksOnlyTheResultOfAToolUseThePersonDenied(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "deny");
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    await turn.decide("Bash", { command: "ls" }, new AbortController().signal, "tu-1");
    await turn.decide("Write", { file_path: "a.ts" }, new AbortController().signal, "tu-2");
    await turn.decide("WebFetch", {}, new AbortController().signal, "tu-3");
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [
        SdkMessages.toolResult("tu-1", "listing"),
        SdkMessages.toolResult("tu-2", "Denied by the TeamRun user.", true),
        SdkMessages.toolResult("tu-3", "Denied by the TeamRun user.", true)
      ]),
      SdkMessages.success("s-1", "All done")
    ]);

    await TurnFeed.consume(turn, query);

    Assert.areEqual([
      "{\"toolUseId\":\"tu-1\",\"isError\":false}",
      "{\"toolUseId\":\"tu-2\",\"isError\":true,\"denied\":true}",
      "{\"toolUseId\":\"tu-3\",\"isError\":true}"
    ].join(","), listener.details.map(t => JSON.stringify(t.payload)).filter(t => t.includes("toolUseId")).join(","));
  }

  @TestMethod
  public async marksADenialItAsksForAnotherTurnInThatTurnsResult(): Promise<void> {
    const asker = new RecordingTurnListener();
    asker.decisions.push("deny");
    const owner = new RecordingTurnListener();
    const asking = new ClaudeTurn(asker, "s-1", new DeltaStream(asker, 1));
    const reporting = new ClaudeTurn(owner, "s-1", new DeltaStream(owner, 1));
    await asking.decide("Write", { file_path: "a.ts" }, new AbortController().signal, "tu-2", "Explore", reporting);
    const result = () => new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "Denied by the TeamRun user.", true)]),
      SdkMessages.success("s-1", "All done")
    ]);

    await TurnFeed.consume(asking, result());
    await TurnFeed.consume(reporting, result());

    Assert.areEqual("Explore", (asker.asks[0]?.payload as Record<string, unknown> | undefined)?.["subAgent"]);
    Assert.areEqual("{\"toolUseId\":\"tu-2\",\"isError\":true}",
      asker.details.map(t => JSON.stringify(t.payload)).filter(t => t.includes("toolUseId")).join(","));
    Assert.areEqual("{\"toolUseId\":\"tu-2\",\"isError\":true,\"denied\":true}",
      owner.details.map(t => JSON.stringify(t.payload)).filter(t => t.includes("toolUseId")).join(","));
  }

  @TestMethod
  public async leavesTheResultOfASkippedAskUserQuestionUnmarked(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    await turn.decide("AskUserQuestion", ClaudeTurnTests.questions, new AbortController().signal, "tu-q");
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.user("55555555-5555-5555-5555-555555555555", [SdkMessages.toolResult("tu-q", "The TeamRun user didn't answer these questions.", true)]),
      SdkMessages.success("s-1", "All done")
    ]);

    await TurnFeed.consume(turn, query);

    Assert.areEqual("{\"toolUseId\":\"tu-q\",\"isError\":true}", listener.details.map(t => JSON.stringify(t.payload)).filter(t => t.includes("toolUseId")).join(","));
  }

  @TestMethod
  public async reportsASubAgentsOwnStepsPlanAndTextUnderItButNotItsThinking(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agent = "11111111-1111-1111-1111-111111111111:0";
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-40", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", subagent_type: "Explore", prompt: "Find it" })], "claude-opus-5"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("Looking around"), SdkMessages.thinking("Hmm"),
        SdkMessages.toolUse("toolu_b", "Bash", { command: "ls" }),
        SdkMessages.toolUse("toolu_t", "TodoWrite", { todos: [{ content: "Read", status: "in_progress", activeForm: "Reading" }] })], "claude-haiku-5", "toolu_a"),
      SdkMessages.user("33333333-3333-3333-3333-333333333333", [SdkMessages.toolResult("toolu_b", "parser.ts"), SdkMessages.toolResult("toolu_t", "ok")], "toolu_a"),
      SdkMessages.assistant("77777777-7777-7777-7777-777777777777", [SdkMessages.toolUse("toolu_n", "Agent", { description: "Read the tests" })], "claude-haiku-5", "toolu_a"),
      SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.toolUse("toolu_c", "Bash", { command: "rm" })], "claude-haiku-5", "toolu_x"),
      SdkMessages.user("55555555-5555-5555-5555-555555555555", [SdkMessages.toolResult("toolu_c", "gone")], "toolu_x"),
      SdkMessages.user("66666666-6666-6666-6666-666666666666", [SdkMessages.toolResult("toolu_a", "Found it in parser.ts")], null,
        { status: "completed", totalToolUseCount: 2, totalTokens: 900, totalDurationMs: 3000 }),
      SdkMessages.success("s-40", "Done.")
    ]);

    await TurnFeed.consume(turn, query);
    const agents = listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    const last = agents.at(-1);

    Assert.areEqual(JSON.stringify(["22222222-2222-2222-2222-222222222222:0", "22222222-2222-2222-2222-222222222222:2", `teamrun-plan:${agent}`,
      "33333333-3333-3333-3333-333333333333:0", "77777777-7777-7777-7777-777777777777:0"]), JSON.stringify(listener.details.filter(t => t.parentItemId === agent).map(t => t.providerItemId)));
    Assert.areEqual(DetailKind.Note, listener.details.find(t => t.text === "Looking around")?.kind);
    Assert.areEqual(JSON.stringify([agent, "77777777-7777-7777-7777-777777777777:0"]),
      JSON.stringify([...new Set(listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => t.providerItemId))]));
    Assert.areEqual("Completed|Explore|claude-haiku-5|2|900|3000", `${last?.status}|${last?.type}|${last?.model}|${last?.toolUses}|${last?.tokens}|${last?.durationMs}`);
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Text || t.text === "Hmm" || t.providerItemId === "teamrun-plan"));
    Assert.isFalse(listener.details.some(t => t.providerItemId?.startsWith("44444444") === true || t.providerItemId?.startsWith("55555555") === true));
    Assert.isNull(listener.details.find(t => t.providerItemId === "66666666-6666-6666-6666-666666666666:0")?.parentItemId);
    Assert.areEqual("claude-opus-5", listener.lastObserved?.model);
  }

  @TestMethod
  public async namesTheSubAgentThatAsksForATool(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    listener.defaultDecision = "allow";

    await turn.decide("Bash", { command: "npm test" }, new AbortController().signal, "toolu_b", "Explore the parser");
    await turn.decide("Bash", { command: "npm test" }, new AbortController().signal, "toolu_c");

    Assert.areEqual(JSON.stringify(["Explore the parser", null]), JSON.stringify(listener.asks.map(t => (t.payload as Record<string, unknown>)["subAgent"] ?? null)));
  }

  @TestMethod
  public async failsOnTheUsageLimitWithItsResetWhenTheAccountIsRejectedWithoutOverage(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    await TurnFeed.consume(turn, new FakeClaudeQuery([
      SdkMessages.init("s-7", "none", null, []),
      SdkMessages.rateLimit("s-7", "rejected", 1_800_000_000, "rejected"),
      SdkMessages.limited("77777777-7777-7777-7777-777777777777", "You've hit your limit"),
      SdkMessages.success("s-7", "You've hit your limit")
    ]));
    const result = turn.toResult();

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual(Resources.formatUsageLimitReached(Resources.claudeDisplayName), result.error);
    Assert.areEqual(new Date(1_800_000_000_000).toISOString(), result.limit?.resetsAt);
  }

  @TestMethod
  public async readsNoUsageLimitUnlessARejectedAccountWithoutOverageAlsoEndsTheTurnOnIt(): Promise<void> {
    const cases = [
      [SdkMessages.rateLimit("s-8", "rejected", 1_800_000_000, "allowed")],
      [SdkMessages.rateLimit("s-8", "rejected", 1_800_000_000, "allowed_warning")],
      [SdkMessages.rateLimit("s-8", "allowed_warning", 1_800_000_000)],
      [SdkMessages.rateLimit("s-8", "rejected")],
      []
    ];
    const outcomes: string[] = [];
    for (const [index, events] of cases.entries()) {
      const listener = new RecordingTurnListener();
      const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
      const ended = index === 3 ? SdkMessages.assistant("88888888-8888-8888-8888-888888888888", [SdkMessages.text("Done")], "claude-opus-5")
        : SdkMessages.limited("88888888-8888-8888-8888-888888888888", "You've hit your limit");
      await TurnFeed.consume(turn, new FakeClaudeQuery([SdkMessages.init("s-8", "none", null, []), ...events, ended, SdkMessages.success("s-8", "Done")]));
      const result = turn.toResult();
      outcomes.push(`${result.outcome}:${String(result.limit)}`);
    }

    Assert.areEqual(Array(cases.length).fill(`${TurnOutcome.Completed}:null`).join(","), outcomes.join(","));
  }
}
