/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { PassThrough } from "node:stream";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AcpTerminals, type IProcessTree, StartedProcess } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
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
    const terminals = new AcpTerminals(listener, "Agent", { start: () => started, readEnvironmentAsync: own => Promise.resolve(own) }, new ManualTimer(), process.cwd(), () => ({}), null, tree);
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
}
