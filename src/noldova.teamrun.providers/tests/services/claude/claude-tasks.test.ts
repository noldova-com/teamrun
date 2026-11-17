/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TurnOutcome } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";
import { TaskOutputReader } from "@noldova/teamrun.providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { GateStep } from "../../fixtures/gate-step.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WaitForCloseStep } from "../../fixtures/wait-for-close-step.fixture.js";
import { WaitForInterruptStep } from "../../fixtures/wait-for-interrupt-step.fixture.js";
import { WaitForStopStep } from "../../fixtures/wait-for-stop-step.fixture.js";

@TestClass
export class ClaudeTasksTests {
  @TestMethod
  @TestData("completed", BackgroundTaskStatus.Completed)
  @TestData("failed", BackgroundTaskStatus.Failed)
  @TestData("stopped", BackgroundTaskStatus.Stopped)
  public async showsABackgroundedShellCommandAndEndsItWithItsOutputAndStatus(status: "completed" | "failed" | "stopped", expected: BackgroundTaskStatus): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task.output");
    writeFileSync(outputFile, "listening on 3000\n");
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tool-1", "Bash", { command: "npm run dev", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-1", "task-1", "tool-1", true),
      SdkMessages.taskNotification("s-1", "task-1", status, outputFile),
      SdkMessages.success("s-1", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      const result = await adapter.runTurn(host.createRequest("Start it"), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([["task-1", "npm run dev"]]), JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command])));
      Assert.areEqual(JSON.stringify([{ taskId: "task-1", text: "listening on 3000\n" }]), JSON.stringify(listener.taskOutputs));
      Assert.areEqual(JSON.stringify([["task-1", expected, null]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsARunningTasksOutputAsItIsWrittenAndTheRestAtItsEnd(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-7.output");
    writeFileSync(outputFile, "starting\n");
    const gate = new GateStep();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-7", "none", null, []),
      SdkMessages.assistant("77777777-7777-7777-7777-777777777777", [SdkMessages.toolUse("tool-7", "Bash", { command: "npm run dev", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-7", "task-7", "tool-7", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-7", ClaudeTasksTests.backgrounded("task-7", outputFile))]),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-7", ClaudeTasksTests.backgrounded("task-7", outputFile))]),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-other", ClaudeTasksTests.backgrounded("task-other", host.directory.resolve("other.output")))]),
      gate,
      SdkMessages.taskNotification("s-7", "task-7", "completed", outputFile),
      SdkMessages.success("s-7", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Start it"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskOutputs.length === 1, "The listener did not see a task output.");
      appendFileSync(outputFile, "ready\n");
      await ClaudeTasksTests.tick(host);
      const followed = listener.taskOutputs.length;
      appendFileSync(outputFile, "done\n");
      gate.open();
      await running;

      Assert.areEqual(2, followed);
      Assert.areEqual(JSON.stringify(["starting\n", "ready\n", "done\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
      Assert.areEqual(TaskOutputReader.readTail(outputFile), listener.taskOutputs.map(output => output.text).join(""));
      Assert.areEqual(JSON.stringify([["task-7", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsAFollowedFilesOutputOnceTheFileAppears(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-8.output");
    const gate = new GateStep();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.assistant("88888888-8888-8888-8888-888888888888", [SdkMessages.toolUse("tool-8", "Bash", { command: "npm test", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-8", "task-8", "tool-8", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-8", ClaudeTasksTests.backgrounded("task-8", outputFile))]),
      gate,
      SdkMessages.taskNotification("s-8", "task-8", "completed", outputFile),
      SdkMessages.success("s-8", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Test it"), listener, new AbortController().signal);
      await Wait.until(() => host.timer.pending === 1, "The timer did not hold just one wait.");
      await ClaudeTasksTests.tick(host);
      const before = listener.taskOutputs.length;
      writeFileSync(outputFile, "passed\n");
      await ClaudeTasksTests.tick(host);
      gate.open();
      await running;

      Assert.areEqual(0, before);
      Assert.areEqual(JSON.stringify(["passed\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsFollowingATasksOutputOnceTheTaskIsStopped(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-9.output");
    writeFileSync(outputFile, "watching\n");
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-9", "none", null, []),
      SdkMessages.assistant("99999999-9999-9999-9999-999999999999", [SdkMessages.toolUse("tool-9", "Bash", { command: "npm run watch", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-9", "task-9", "tool-9", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-9", ClaudeTasksTests.backgrounded("task-9", outputFile))]),
      new WaitForStopStep(),
      SdkMessages.taskNotification("s-9", "task-9", "stopped", outputFile),
      SdkMessages.success("s-9", "Stopped")
    ]);
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Watch"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskOutputs.length === 1, "The listener did not see a task output.");
      await listener.taskStarts[0]?.stop();
      await running;
      appendFileSync(outputFile, "after the stop\n");
      host.timer.advance(host.timings.taskOutputInterval);

      Assert.areEqual(0, host.timer.pending);

      Assert.areEqual(JSON.stringify(["watching\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
      Assert.areEqual(JSON.stringify([["task-9", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsFollowingATasksOutputOnceClaudeCodeExits(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-10.output");
    writeFileSync(outputFile, "serving\n");
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-10", "none", null, []),
      SdkMessages.assistant("10101010-1010-1010-1010-101010101010", [SdkMessages.toolUse("tool-10", "Bash", { command: "npm start", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-10", "task-10", "tool-10", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-10", ClaudeTasksTests.backgrounded("task-10", outputFile))]),
      SdkMessages.success("s-10", "Started")
    ]);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Serve"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      appendFileSync(outputFile, "after the exit\n");
      host.timer.advance(host.timings.taskOutputInterval);

      Assert.areEqual(0, host.timer.pending);

      Assert.areEqual(JSON.stringify(["serving\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
      Assert.areEqual(JSON.stringify([["task-10", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsWhatItHeldOfATasksOutputWhenClaudeCodeExits(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-14.output");
    writeFileSync(outputFile, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from("5%", "utf16le")]));
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-14", "none", null, []),
      SdkMessages.assistant("14141414-1414-1414-1414-141414141414", [SdkMessages.toolUse("tool-14", "Bash", { command: "npm run build", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-14", "task-14", "tool-14", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-14", ClaudeTasksTests.backgrounded("task-14", outputFile))]),
      SdkMessages.success("s-14", "Started")
    ]);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Build"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual("5%", TaskOutputReader.readTail(outputFile));
      Assert.areEqual(JSON.stringify(["5%"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
      Assert.areEqual(JSON.stringify([["task-14", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsAForegroundCommandOnlyOnceItMovesToTheBackgroundAndIgnoresOtherTasks(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-2", "none", null, []),
      SdkMessages.taskStarted("s-2", "quick", undefined, false, "List files"),
      SdkMessages.taskNotification("s-2", "quick", "completed", host.directory.resolve("missing.output")),
      SdkMessages.taskStarted("s-2", "agent", undefined, true, "Explore the code", "local_agent"),
      SdkMessages.taskStarted("s-2", "slow", undefined, false, "Build the app"),
      SdkMessages.taskUpdated("s-2", "slow", true),
      SdkMessages.taskUpdated("s-2", "slow", true),
      SdkMessages.taskNotification("s-2", "slow", "completed", host.directory.resolve("missing.output")),
      SdkMessages.success("s-2", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Build"), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([["slow", "Build the app"]]), JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command])));
      Assert.areEqual(0, listener.taskOutputs.length);
      Assert.areEqual(JSON.stringify([["slow", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async namesATaskByItsDescriptionWhenItsCallHasNoCommandAndShowsItOnce(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-6", "none", null, []),
      SdkMessages.assistant("66666666-6666-6666-6666-666666666666", [SdkMessages.toolUse("tool-a", "Bash", { run_in_background: true }),
        SdkMessages.toolUse("tool-b", "Bash", { command: " ", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-6", "task-a", "tool-a", true),
      SdkMessages.taskStarted("s-6", "task-a", "tool-a", true),
      SdkMessages.taskStarted("s-6", "task-b", "tool-b", true, " "),
      SdkMessages.success("s-6", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(JSON.stringify([["task-a", "Start the server"]]), JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command])));
      Assert.areEqual(JSON.stringify([["task-a", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsAndEndsATaskStillRunningWhenClaudeCodeExits(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-3", "none", null, []),
      SdkMessages.taskStarted("s-3", "server", undefined, true, "npm start"),
      SdkMessages.success("s-3", "Started")
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual("server", query.stoppedTasks.join(","));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsATaskThroughClaude(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-4", "none", null, []),
      SdkMessages.taskStarted("s-4", "server", undefined, true, "npm start"),
      new WaitForStopStep(),
      SdkMessages.taskNotification("s-4", "server", "stopped", host.directory.resolve("missing.output")),
      SdkMessages.success("s-4", "Stopped")
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await listener.taskStarts[0]?.stop();
      await running;

      Assert.areEqual("server", query.stoppedTasks.join(","));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesTheQueryOnceTheLastTaskIsStoppedAfterItsTurnEnded(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-5", "none", null, []),
      SdkMessages.taskStarted("s-5", "server", undefined, true, "npm start"),
      SdkMessages.success("s-5", "Started"),
      new WaitForStopStep(),
      SdkMessages.taskNotification("s-5", "server", "stopped", host.directory.resolve("missing.output")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      const result = await adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      const open = [query.closeCount, adapter.activeRunCount];
      await listener.taskStarts[0]!.stop();
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return query.closeCount === 1;
      }, "The query was not closed after the idle limit.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([0, 1]), JSON.stringify(open));
      Assert.areEqual("server", query.stoppedTasks.join(","));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async rejectsWithClaudesErrorWhenTheStopIsRefused(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-5", "none", null, []),
      SdkMessages.taskStarted("s-5", "server", undefined, true, "npm start"),
      new WaitForInterruptStep(),
      SdkMessages.success("s-5", "Interrupted")
    ]);
    query.stopTaskFailure = new Error("No task found with ID: server");
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const controller = new AbortController();

    try {
      const running = adapter.runTurn(host.createRequest("Start"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      let refusal: unknown = null;
      await listener.taskStarts[0]?.stop().catch((error: unknown) => { refusal = error; });
      controller.abort();
      await running;
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual("No task found with ID: server", refusal instanceof Error ? refusal.message : null);
      Assert.areEqual(0, query.stoppedTasks.length);
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsTheEndOfTheFileTheEndNamesWhenItIsNotTheFollowedOne(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const followedFile = host.directory.resolve("task-11.output");
    const namedFile = host.directory.resolve("task-11-final.output");
    writeFileSync(followedFile, "followed\n");
    writeFileSync(namedFile, "the end\n");
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-11", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tool-11", "Bash", { command: "npm run build", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-11", "task-11", "tool-11", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-11", ClaudeTasksTests.backgrounded("task-11", followedFile))]),
      SdkMessages.taskNotification("s-11", "task-11", "completed", namedFile),
      SdkMessages.success("s-11", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Build it"), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify(["followed\n", "the end\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
      Assert.areEqual(0, host.timer.pending);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async followsNoFileForAToolResultThatArrivesWhileAClosingQueryStopsItsTasks(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const outputFile = host.directory.resolve("task-12.output");
    writeFileSync(outputFile, "building\n");
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-12", "none", null, []),
      SdkMessages.assistant("12121212-1212-1212-1212-121212121212", [SdkMessages.toolUse("tool-12", "Bash", { command: "npm run build", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-12", "task-12", "tool-12", true),
      new WaitForStopStep(),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-12", ClaudeTasksTests.backgrounded("task-12", outputFile))]),
      new WaitForInterruptStep(),
      SdkMessages.success("s-12", "Stopped")
    ]);
    query.stopTaskGate = gate;
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("Build"), listener, new AbortController().signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    const stopping = adapter.shutdown();
    await Wait.until(() => host.timer.pending === 1, "The timer did not hold just one wait.");
    gate.open();
    await stopping;
    await running;

    Assert.areEqual(0, host.timer.pending);
    Assert.areEqual(JSON.stringify(["building\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
    Assert.areEqual(JSON.stringify([["task-12", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
  }

  @TestMethod
  public async followsAnOutputFileWhosePathHasSpaces(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    mkdirSync(host.directory.resolve("my tasks"));
    const outputFile = host.directory.resolve("my tasks/task 13.output");
    writeFileSync(outputFile, "spaced\n");
    const gate = new GateStep();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-13", "none", null, []),
      SdkMessages.assistant("13131313-1313-1313-1313-131313131313", [SdkMessages.toolUse("tool-13", "Bash", { command: "npm run dev", run_in_background: true })], "claude-opus-5"),
      SdkMessages.taskStarted("s-13", "task-13", "tool-13", true),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-13", `${ClaudeTasksTests.backgrounded("task-13", outputFile)}.`)]),
      gate,
      SdkMessages.taskNotification("s-13", "task-13", "completed", outputFile),
      SdkMessages.success("s-13", "ok")
    ]);
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Serve it"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskOutputs.length === 1, "The listener did not see a task output.");
      appendFileSync(outputFile, "still spaced\n");
      await ClaudeTasksTests.tick(host);
      const followed = listener.taskOutputs.length;
      gate.open();
      await running;

      Assert.areEqual(2, followed);
      Assert.areEqual(JSON.stringify(["spaced\n", "still spaced\n"]), JSON.stringify(listener.taskOutputs.map(output => output.text)));
    }
    finally { await adapter.shutdown(); }
  }

  private static async tick(host: ClaudeTestHost): Promise<void> {
    let read = false;
    void host.timer.delayed.then(() => { read = true; });
    host.timer.advance(host.timings.taskOutputInterval);
    await Wait.until(() => read, "The task output was not read.");
  }

  private static backgrounded(taskId: string, outputFile: string): string {
    return `Command running in background with ID: ${taskId}. Output is being written to: ${outputFile}`;
  }
}
