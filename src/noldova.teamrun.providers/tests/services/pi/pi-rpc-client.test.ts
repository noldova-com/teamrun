/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PiRpcClient, PiRpcException, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { PiTestHost } from "../../fixtures/pi-test-host.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class PiRpcClientTests {
  @TestMethod
  public async answersCommandsWithTheirDataRefusalsWithTheirReasonAndSilenceWithATimeout(): Promise<void> {
    using host = new PiTestHost();
    const client = host.createClient();
    const unstarted = host.createClient();

    await unstarted.stop();
    client.start(null);
    const state = await client.request("get_state", {}, 5000);
    const empty = await client.request("set_thinking_level", { level: "high" }, 5000);
    const refused = await Assert.throwsAsync(() => client.request("bogus", {}, 5000), PiRpcException);
    const silent = await Assert.throwsAsync(() => client.request("refuse-silently", {}, 5000), PiRpcException);
    const timedOut = await Assert.throwsAsync(() => client.request("never", {}, 50), PiRpcException);
    const twice = Assert.throws(() => client.start(null), PiRpcException);
    await client.stop();
    await client.stop();
    const stopped = await Assert.throwsAsync(() => client.request("get_state", {}, 5000), PiRpcException);
    client.send({ type: "abort" });
    const exit = await client.waitForExit();

    Assert.areEqual("medium", state.readString("thinkingLevel"));
    Assert.areEqual("{}", JSON.stringify(empty.toJson()));
    Assert.areEqual("Pi refused bogus: Unknown command: bogus.", refused.message);
    Assert.areEqual("Pi refused refuse-silently: it gave no reason.", silent.message);
    Assert.areEqual(Resources.formatPiTimedOut("never"), timedOut.message);
    Assert.areEqual(Resources.piAlreadyStarted, twice.message);
    Assert.areEqual(Resources.formatPiNotRunning("get_state"), stopped.message);
    Assert.areEqual(0, exit.code);
    Assert.isFalse(client.isAlive);
    Assert.isFalse(unstarted.isAlive);
    Assert.areEqual(JSON.stringify(["teamrun-1", "teamrun-2"]), JSON.stringify(host.records.slice(1, 3).map(t => t["id"])));
  }

  @TestMethod
  public async goesOnReadingWhenTheEventHandlerThrows(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "extras" });
    const client = host.createClient();

    client.start(() => { throw new Error("The handler failed."); });
    await client.request("prompt", { message: "Go" }, 5000);
    await Wait.until(() => client.handlerFailureCount > 1, "The handler did not fail twice.");
    const state = await client.request("get_state", {}, 5000);
    await client.stop();

    Assert.isNotNull(state);
  }

  @TestMethod
  public async countsAnEventWhoseHandlersPromiseRejectsAndGoesOnReading(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "extras" });
    const client = host.createClient();

    client.start(() => Promise.reject(new Error("The handler failed.")));
    await client.request("prompt", { message: "Go" }, 5000);
    await Wait.until(() => client.handlerFailureCount > 1, "The handler did not fail twice.");
    const state = await client.request("get_state", {}, 5000);
    await client.stop();

    Assert.isNotNull(state);
  }

  @TestMethod
  public async cancelsAnExtensionsDialogsWithoutAHandlerAndLeavesItsOtherRequests(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "extras" });
    const client = host.createClient();

    client.start(null);
    await client.request("prompt", { message: "Go" }, 5000);
    await Wait.until(() => host.commands("extension_ui_response").length === 2, "Pi did not get 2 extension_ui_response commands.");
    await client.request("get_state", {}, 5000);
    await client.stop();

    Assert.areEqual(JSON.stringify([["ui-2", true], ["ui-5", true]]), JSON.stringify(host.commands("extension_ui_response").map(t => [t["id"], t["cancelled"]])));
  }

  @TestMethod
  public async splitsRecordsOnLineFeedsOnlyAndSkipsBlankAndUnreadableLines(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "extras" });
    const client = host.createClient();
    const events: JsonReader[] = [];

    client.start(event => {
      events.push(event);
    });
    await client.request("prompt", { message: "Go" }, 5000);
    await Wait.until(() => events.some(t => t.readString("type") === "agent_settled"), "The client did not get agent_settled.");
    await client.stop();

    const types = events.map(t => t.readString("type"));
    const deltas = events.filter(t => t.readString("type") === "message_update").map(t => t.readObject("assistantMessageEvent").readString("delta"));
    Assert.areEqual("one two", deltas[0]);
    Assert.isTrue(types.includes("response"));
    Assert.isFalse(types.some(t => t.length === 0));
  }

  @TestMethod
  public async failsWhatItWaitsForWhenPiExitsAndNamesWhatPiWroteToStderr(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "exit" });
    const client = host.createClient();

    client.start(null);
    const waiting = Assert.throwsAsync(() => client.request("never", {}, 5000), PiRpcException);
    await client.request("prompt", { message: "Go" }, 5000);
    const failure = await waiting;
    const exit = await client.waitForExit();

    Assert.areEqual(3, exit.code);
    Assert.areEqual(Resources.formatPiExited(3, null, client.stderr), failure.message);
  }

  @TestMethod
  public async endsAPiThatOutlivesTheGraceAfterItsInputClosesAndWritesNothingOnceInputHasClosed(): Promise<void> {
    using host = new PiTestHost({ TEAMRUN_FAKE_PI_STAY: "1" });
    const client = host.createClient(["--mode", "rpc"], 50);

    client.start(null);
    await client.request("get_state", {}, 5000);
    const stopping = client.stop();
    client.send({ type: "never" });
    await stopping;
    await client.waitForExit();

    Assert.isFalse(client.isAlive);
    Assert.isFalse(host.records.some(t => t["type"] === "never"));
  }

  @TestMethod
  public async failsItsCommandsWhenPiCannotStart(): Promise<void> {
    using host = new PiTestHost();
    const client = new PiRpcClient(new ProcessCommand(host.directory.resolve("missing-pi"), []), host.environment, null, host.starter, 50);

    client.start(null);
    await Wait.until(() => !client.isAlive, "The client is still alive.");
    const failure = await Assert.throwsAsync(() => client.request("get_state", {}, 5000), PiRpcException);

    Assert.areEqual(Resources.formatPiNotRunning("get_state"), failure.message);
  }
}
