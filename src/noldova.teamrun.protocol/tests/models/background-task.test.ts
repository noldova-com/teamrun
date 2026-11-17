/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackgroundTask, BackgroundTaskStatus, Resources } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskTests {
  private static readonly running: object = {
    id: "task-1", chatId: "conv-1", messageId: "msg-1", kind: "codex", command: "npm run dev", status: "Running", exitCode: null,
    startedAt: "2026-10-21T10:00:00.000Z", endedAt: null, output: "ready\n", subAgentId: null, commandCut: false
  };

  @TestMethod
  public leavesOutOnlyOutputItHasAndKeepsItOutThroughJsonAndMoreOutput(): void {
    const task = BackgroundTask.fromJson(BackgroundTaskTests.running);

    const left = task.withoutOutput();
    const empty = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, output: String.empty });

    Assert.isNull(left.output);
    Assert.isNull(BackgroundTask.fromJson(left.toJson()).output);
    Assert.isNull(left.withOutput("more").output);
    Assert.areEqual("ready\n", task.output);
    Assert.areEqual(String.empty, empty.withoutOutput().output);
    Assert.areEqual(task.command, left.command);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = BackgroundTask.fromJson(BackgroundTaskTests.running);

    Assert.areEqual(JSON.stringify(BackgroundTaskTests.running), JSON.stringify(value.toJson()));
    Assert.isTrue(value.isRunning);
  }

  @TestMethod
  public cutsALongCommandForAListAndLeavesItsOutputOutSoOpeningItReadsTheWholeTask(): void {
    const long = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, command: `  ${"a".repeat(Resources.maximumListedCommand)}b`, output: String.empty });
    const fits = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, command: "a".repeat(Resources.maximumListedCommand) });

    const cut = long.withCommandCut();
    const read = BackgroundTask.fromJson(cut.toJson());
    const held = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, commandCut: true });

    Assert.areEqual("a".repeat(Resources.maximumListedCommand), cut.command);
    Assert.isNull(cut.output);
    Assert.areEqual("true:true", [cut.commandCut, read.commandCut].join(":"));
    Assert.areEqual("true:true:true", [held.withOutput("x").commandCut, held.withoutOutput().commandCut,
      held.withEnd(BackgroundTaskStatus.Stopped, null, "2026-10-21T10:01:00.000Z").commandCut].join(":"));
    Assert.isTrue(fits.withCommandCut() === fits);
    Assert.isFalse(long.commandCut);
    Assert.isFalse(BackgroundTask.fromJson(JSON.parse(JSON.stringify({ ...BackgroundTaskTests.running, commandCut: undefined }))).commandCut);
    Assert.throws(() => BackgroundTask.fromJson({ ...BackgroundTaskTests.running, commandCut: "yes" }), JsonException);
  }

  @TestMethod
  public cutsACommandBeforeAPairItWouldSplitAndCountsItsLengthWithoutItsLeadingSpace(): void {
    const pair = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, command: `${"a".repeat(Resources.maximumListedCommand - 1)}\u{1F600}b` }).withCommandCut();
    const whole = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, command: `${"a".repeat(Resources.maximumListedCommand - 2)}\u{1F600}b` }).withCommandCut();
    const spaced = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, command: `\n  ${"a".repeat(Resources.maximumListedCommand)}` }).withCommandCut();

    Assert.areEqual(`${"a".repeat(Resources.maximumListedCommand - 1)}:true`, `${pair.command}:${pair.commandCut}`);
    Assert.areEqual(`${"a".repeat(Resources.maximumListedCommand - 2)}\u{1F600}:true`, `${whole.command}:${whole.commandCut}`);
    Assert.areEqual(`${"a".repeat(Resources.maximumListedCommand)}:false:ready\n`, `${spaced.command}:${spaced.commandCut}:${spaced.output}`);
  }

  @TestMethod
  public namesTheSubAgentItRunsThroughItsOutputAndEnd(): void {
    const task = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, subAgentId: "toolu_1" });

    const ended = task.withOutput("more").withEnd(BackgroundTaskStatus.Stopped, null, "2026-10-21T10:01:00.000Z");

    Assert.areEqual("toolu_1", ended.subAgentId);
    Assert.areEqual("toolu_1", BackgroundTask.fromJson(ended.toJson()).subAgentId);
    Assert.isNull(BackgroundTask.fromJson({ ...BackgroundTaskTests.running, subAgentId: " " }).subAgentId);
    Assert.throws(() => BackgroundTask.fromJson({ ...BackgroundTaskTests.running, subAgentId: 1 }), JsonException);
  }

  @TestMethod
  public endsWithTheReportedStatusAndExitCode(): void {
    const ended = BackgroundTask.fromJson(BackgroundTaskTests.running).withEnd(BackgroundTaskStatus.Failed, 2, "2026-10-21T10:01:00.000Z");

    Assert.areEqual(BackgroundTaskStatus.Failed, ended.status);
    Assert.areEqual(2, ended.exitCode);
    Assert.areEqual("2026-10-21T10:01:00.000Z", ended.endedAt);
    Assert.areEqual("ready\n", ended.output);
    Assert.isFalse(ended.isRunning);
  }

  @TestMethod
  public keepsTheLatestOutputWithinItsBound(): void {
    const task = BackgroundTask.fromJson({ ...BackgroundTaskTests.running, output: String.empty });
    const first = "a".repeat(Resources.maximumBackgroundTaskOutput - 1);

    const appended = task.withOutput(first).withOutput("bc");

    Assert.areEqual(Resources.maximumBackgroundTaskOutput, appended.output?.length);
    Assert.isTrue(appended.output?.endsWith("abc") ?? false);
    Assert.areEqual("x", task.withOutput("x").output);
  }

  @TestMethod
  public rejectsAnEndThatContradictsTheStatus(): void {
    const task = BackgroundTask.fromJson(BackgroundTaskTests.running);
    const make = (status: BackgroundTaskStatus, exitCode: number | null, endedAt: string | null): BackgroundTask =>
      new BackgroundTask(task.id, task.chatId, task.messageId, task.kind, task.command, status, exitCode, task.startedAt, endedAt, task.output);

    Assert.throws(() => make(BackgroundTaskStatus.Running, null, "2026-10-21T10:01:00.000Z"), ArgumentException);
    Assert.throws(() => make(BackgroundTaskStatus.Completed, 0, null), ArgumentException);
    Assert.throws(() => make(BackgroundTaskStatus.Running, 0, null), ArgumentException);
    Assert.throws(() => task.withEnd(BackgroundTaskStatus.Running, null, "2026-10-21T10:01:00.000Z"), ArgumentException);
    Assert.areEqual(BackgroundTaskStatus.Ended, make(BackgroundTaskStatus.Ended, null, "2026-10-21T10:01:00.000Z").status);
  }

  @TestMethod
  public rejectsBlankArguments(): void {
    const task = BackgroundTask.fromJson(BackgroundTaskTests.running);
    const blank = String.empty;

    Assert.throws(() => new BackgroundTask(blank, task.chatId, task.messageId, task.kind, task.command, task.status, null, task.startedAt, null, String.empty), ArgumentException);
    Assert.throws(() => new BackgroundTask(task.id, blank, task.messageId, task.kind, task.command, task.status, null, task.startedAt, null, String.empty), ArgumentException);
    Assert.throws(() => new BackgroundTask(task.id, task.chatId, blank, task.kind, task.command, task.status, null, task.startedAt, null, String.empty), ArgumentException);
    Assert.throws(() => new BackgroundTask(task.id, task.chatId, task.messageId, blank, task.command, task.status, null, task.startedAt, null, String.empty), ArgumentException);
    Assert.throws(() => new BackgroundTask(task.id, task.chatId, task.messageId, task.kind, blank, task.status, null, task.startedAt, null, String.empty), ArgumentException);
    Assert.throws(() => new BackgroundTask(task.id, task.chatId, task.messageId, task.kind, task.command, task.status, null, blank, null, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const status = Assert.throws(() => BackgroundTask.fromJson({ ...BackgroundTaskTests.running, status: "Paused" }), JsonException);
    const exitCode = Assert.throws(() => BackgroundTask.fromJson({ ...BackgroundTaskTests.running, exitCode: 1.5 }), JsonException);

    Assert.areEqual("$.status", status.path);
    Assert.areEqual("$.exitCode", exitCode.path);
  }
}
