/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AcpRequestException, AcpTerminals, type IProcessTree, Resources, StartedProcess } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

class HeldTaskListener extends RecordingTurnListener {
  public heldStart: Promise<void> | null = null;

  public override async onTaskStartedAsync(start: TaskStart): Promise<void> {
    await super.onTaskStartedAsync(start);
    if (!Object.isNull(this.heldStart))
      await this.heldStart;
  }

  public override async onTaskEndedAsync(end: TaskEnd): Promise<void> {
    await super.onTaskEndedAsync(end);
    throw new Error("Ended unread");
  }
}

@TestClass
export class AcpTerminalsTests {
  @TestMethod
  public async showsOutputThatArrivesWhileItsStartIsShownAfterItAndFailsTheChannelWhenItsEndCannotBeShown(): Promise<void> {
    const listener = new HeldTaskListener();
    const held = Promise.withResolvers<void>();
    listener.heldStart = held.promise;
    const started = new StartedProcess();
    const output = new PassThrough();
    const errors = new PassThrough();
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: () => Promise.resolve() };
    const terminals = new AcpTerminals(listener, "Agent", { start: () => started, readEnvironmentAsync: own => Promise.resolve(own) }, new ManualTimer(), process.cwd(), () => ({}), null, tree,
      "linux");
    let settled = 0;
    const failures: unknown[] = [];
    terminals.begin("s", () => settled++, t => failures.push(t));
    const created = await terminals.request("terminal/create", JsonReader.fromValue({ sessionId: "s", command: "node" }));
    const terminalId = JsonReader.fromValue(created).readNonBlankString("terminalId");
    started.attach(7, new PassThrough(), output, errors, () => Promise.resolve());

    const following = terminals.noteAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", status: "completed",
      content: [{ type: "terminal", terminalId }] } }));
    await Wait.until(() => listener.taskStarts.length === 1, "The task did not start.");
    const seen = once(started.stdout, "data");
    output.write("late");
    await seen;
    const whileHeld = listener.taskOutputs.length;
    held.resolve();
    await following;
    output.end();
    errors.end();
    started.end(1, null);
    await Wait.until(() => failures.length === 1, "The channel was not failed.");

    Assert.areEqual(0, whileHeld);
    Assert.areEqual(JSON.stringify([[terminalId, "late"]]), JSON.stringify(listener.taskOutputs.map(t => [t.taskId, t.text])));
    Assert.areEqual(JSON.stringify([terminalId]), JSON.stringify(listener.taskEnds.map(t => t.taskId)));
    const [failure] = failures;
    Assert.isInstanceOf(failure, Error);
    Assert.areEqual("Ended unread", failure.message);
    Assert.areEqual(1, settled);
    Assert.isTrue(terminals.isIdle);
  }

  @TestMethod
  public async killsATerminalByEndingTheTreeItStartedFromItsSpawnAndNeitherSweepsNorStopsItAfter(): Promise<void> {
    const timer = new ManualTimer();
    const started = new StartedProcess();
    const asked: (readonly [number, number])[] = [];
    const after: string[] = [];
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endOwnTree: (processId, startedBy) => { asked.push([processId, startedBy]); return Promise.resolve(true); },
      endLeftovers: () => { after.push("leftovers"); return Promise.resolve(); } };
    const terminals = new AcpTerminals(new RecordingTurnListener(), "Agent", { start: () => started, readEnvironmentAsync: own => Promise.resolve(own) }, timer, process.cwd(),
      () => ({}), null, tree, "linux");
    terminals.begin("s", () => undefined, () => undefined);
    const created = await terminals.request("terminal/create", JsonReader.fromValue({ sessionId: "s", command: "node" }));
    const terminalId = JsonReader.fromValue(created).readNonBlankString("terminalId");
    timer.advance(5);
    const spawned = timer.now();
    started.attach(7, new PassThrough(), new PassThrough(), new PassThrough(), () => { after.push("stop"); return Promise.resolve(); });
    timer.advance(5);

    const killed = await terminals.request("terminal/kill", JsonReader.fromValue({ sessionId: "s", terminalId }));

    Assert.areEqual(JSON.stringify([{}, [[7, spawned]], []]), JSON.stringify([killed, asked, after]));
  }

  @TestMethod
  public async showsWhyATerminalsCommandFailedToStartAndEndsItWithNoExitCodeThoughTheProcessGaveOne(): Promise<void> {
    const started = new StartedProcess();
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: () => Promise.resolve() };
    const terminals = new AcpTerminals(new RecordingTurnListener(), "Agent", { start: () => started, readEnvironmentAsync: own => Promise.resolve(own) }, new ManualTimer(),
      process.cwd(), () => ({}), null, tree, "linux");
    terminals.begin("s", () => undefined, () => undefined);
    const created = await terminals.request("terminal/create", JsonReader.fromValue({ sessionId: "s", command: "node" }));
    const terminalId = JsonReader.fromValue(created).readNonBlankString("terminalId");

    started.fail(new Error("spawn node EACCES"));
    started.end(-4092, null);
    const exited = await terminals.request("terminal/wait_for_exit", JsonReader.fromValue({ sessionId: "s", terminalId }));
    const output = await terminals.request("terminal/output", JsonReader.fromValue({ sessionId: "s", terminalId }));

    Assert.areEqual(JSON.stringify([{ exitCode: null, signal: null }, `spawn node EACCES${Resources.lineSeparator}`]),
      JSON.stringify([exited, JsonReader.fromValue(output).readString("output")]));
  }

  @TestMethod
  public async runsACommandNamedWithoutAFolderOnWindowsOnlyFromTheTurnsPathAndRefusesOneOnlyTheChatsFolderHolds(): Promise<void> {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    mkdirSync(bin);
    writeFileSync(directory.resolve("git.exe"), "");
    writeFileSync(path.join(bin, "git.exe"), "");
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: () => Promise.resolve() };
    const starts: string[] = [];
    const terminalsWith = (folders: string): AcpTerminals => {
      const made = new AcpTerminals(new RecordingTurnListener(), "Agent", { start: command => { starts.push(command.executable); return new StartedProcess(); },
        readEnvironmentAsync: own => Promise.resolve(own) }, new ManualTimer(), directory.path, () => ({ PATH: folders, PATHEXT: ".exe" }), null, tree, "win32");
      made.begin("s", () => undefined, () => undefined);
      return made;
    };
    const create = { sessionId: "s", command: "git", args: ["status"], env: [{ name: "PATH", value: directory.path }] };

    await terminalsWith(bin).request("terminal/create", JsonReader.fromValue(create));
    const refused = await Assert.throwsAsync(() => terminalsWith(".").request("terminal/create", JsonReader.fromValue(create)), AcpRequestException);

    Assert.areEqual(JSON.stringify([[`${path.join(bin, "git")}.exe`], -32602, Resources.formatCommandNotOnPath("git")]),
      JSON.stringify([starts, refused.code, refused.message]));
  }
}
