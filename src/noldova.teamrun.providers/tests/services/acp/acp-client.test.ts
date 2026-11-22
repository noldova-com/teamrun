/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { JsonException, type JsonObject, type JsonValue } from "@noldova/context.json";
import { TimeoutException } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AcpClient, AcpConnectionException, AcpRequestException, GrokToolGate, type IAcpClientListener, type IProcessTree, MessageFraming, NodeProcessStarter, ProviderTimings,
  Resources, StartedProcess } from "@noldova/teamrun.providers";
import { CopilotTestHost } from "../../fixtures/copilot-test-host.fixture.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { HeldAcpClientListener } from "../../fixtures/held-acp-client-listener.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";
import { ElapsedDelayTimer } from "../../fixtures/elapsed-delay-timer.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class AcpClientTests {
  private static readonly TIMINGS: ProviderTimings = new ProviderTimings(2000, 2000, 2000, 2000, 100, 100, 100, 250, 100, 1, 10);

  @TestMethod
  public async framesEachMessageByItsLengthInBytes(): Promise<void> {
    await using host = new CopilotTestHost();
    const client = new AcpClient(host.command.withArguments("--headless"), { ...host.environment, TEAMRUN_FAKE_COPILOT_HEADLESS: "split" }, host.directory.path,
      host.programs.wrap(new NodeProcessStarter(host.terminator)), AcpClientTests.TIMINGS, host.timer, MessageFraming.ContentLength);
    client.start();
    try {
      await client.request("echo", {}, null);
      const first = client.request("echo", { text: "✦ zwei" });
      const second = client.request("echo", { text: "drei ✦✦" });

      Assert.areEqual(JSON.stringify({ text: "✦ zwei" }), JSON.stringify(await first));
      Assert.areEqual(JSON.stringify({ text: "drei ✦✦" }), JSON.stringify(await second));
    }
    finally {
      await client.stop();
    }
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async readsAFrameWhoseBodyEndsInALaterWrite(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    input.on("finish", () => {
      output.end();
      errors.end();
      started.end(0, null);
    });
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer,
      MessageFraming.ContentLength);
    const unstarted = client.processId;
    client.start();
    const unspawned = client.processId;
    started.attach(7, input, output, errors, () => Promise.resolve());
    try {
      Assert.areEqual(JSON.stringify([null, null, 7]), JSON.stringify([unstarted, unspawned, client.processId]));
      const answer = client.request("echo", {}, null);
      await once(input, "data");
      const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { text: "✦ zwei" } }), "utf8");
      const received = once(started.stdout, "data");
      output.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body.subarray(0, 12)]));
      await received;
      output.write(body.subarray(12));

      Assert.areEqual(JSON.stringify({ text: "✦ zwei" }), JSON.stringify(await answer));
    }
    finally {
      await client.stop();
    }
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async completesAResponseThatArrivedBehindHeldNotificationsAfterTheAgentExits(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    const entered = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer);
    client.setListener({ onRequest: () => Promise.resolve(null), onResponseAsync: () => Promise.resolve(), onExitAsync: () => Promise.resolve(),
      onNotificationAsync: () => {
        entered.resolve();
        return held.promise;
      } });
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    try {
      const answer = client.request(Resources.acpSessionPrompt, {}, null).then(result => JSON.stringify(result), (error: unknown) => String(error));
      await once(input, "data");
      output.write(`${JSON.stringify({ jsonrpc: "2.0", method: "session/update", params: {} })}\n`
        + `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { stopReason: "end_turn" } })}\n`);
      await entered.promise;
      output.end();
      errors.end();
      started.end(0, null);
      await client.processClosed;
      held.resolve();

      Assert.areEqual(JSON.stringify({ stopReason: "end_turn" }), await answer);
    }
    finally {
      held.resolve();
      await client.stop();
    }
  }

  @TestMethod
  public async failsARequestWithTheErrorItsResponseHandlingThrowsAndHandsOnNothingAfterIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    input.on("finish", () => {
      output.end();
      errors.end();
      started.end(0, null);
    });
    const notifications: string[] = [];
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer);
    client.setListener({ onRequest: () => Promise.resolve(null), onExitAsync: () => Promise.resolve(),
      onResponseAsync: () => Promise.reject(new Error("Unreadable response")),
      onNotificationAsync: method => {
        notifications.push(method);
        return Promise.resolve();
      } });
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    try {
      const answer = client.request("echo", {}, null);
      await once(input, "data");
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })}\n${JSON.stringify({ jsonrpc: "2.0", method: "after" })}\n`);
      const failure = await Assert.throwsAsync(() => answer, Error);
      await client.whenHandledAsync();

      Assert.areEqual("Unreadable response", failure.message);
      Assert.areEqual(0, notifications.length);
      Assert.isTrue(client.isStopping);
    }
    finally {
      await client.stop();
    }
  }

  @TestMethod
  public async boundsWhatItEndsAfterTheAgentExitsByItsExitRatherThanTheCloseOfItsOutput(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const output = new PassThrough();
    const errors = new PassThrough();
    const bounds: number[] = [];
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: (_processId, _launched, exited) => { bounds.push(exited); return Promise.resolve(); } };
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer,
      MessageFraming.Lines, tree);
    client.start();
    started.attach(7, new PassThrough(), output, errors, () => Promise.resolve());
    const prompt = client.request(Resources.acpSessionPrompt, {}, null).catch(() => undefined);
    started.end(0, null);
    const exited = Date.now();
    await Wait.until(() => Date.now() > exited, "The clock did not pass the agent's exit.");
    output.end();
    errors.end();
    await prompt;
    await client.stop();

    const [bound] = bounds;
    Assert.isDefined(bound);
    Assert.areEqual(1, bounds.length);
    Assert.isTrue(bound <= exited);
  }

  @TestMethod
  public async endsItsStopAtKillWaitWhenTheListingOfWhatTheAgentLeftNeverSettles(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const output = new PassThrough();
    const errors = new PassThrough();
    const swept: number[] = [];
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: processId => { swept.push(processId); return new Promise<void>(() => undefined); } };
    const timer = new ElapsedDelayTimer(AcpClientTests.TIMINGS.killWait);
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, timer,
      MessageFraming.Lines, tree);
    client.start();
    started.attach(7, new PassThrough(), output, errors, () => Promise.resolve());
    const prompt = client.request(Resources.acpSessionPrompt, {}, null).catch(() => undefined);
    started.end(0, null);
    output.end();
    errors.end();
    await prompt;
    await client.stop();

    Assert.areEqual(JSON.stringify([7]), JSON.stringify(swept));
    Assert.areEqual(JSON.stringify([AcpClientTests.TIMINGS.killWait]), JSON.stringify(timer.requested.filter(t => t === AcpClientTests.TIMINGS.killWait)));
  }

  @TestMethod
  public async endsWhatTheAgentLeftOnlyOnceItOpenedASessionNamingMcpServers(): Promise<void> {
    await using host = new CopilotTestHost();
    const swept: number[] = [];
    const tree: IProcessTree = { endTree: () => Promise.resolve(true), endOwnTree: () => Promise.resolve(true), endDescendants: () => Promise.resolve(),
      endLeftovers: processId => { swept.push(processId); return Promise.resolve(); } };
    const opened: JsonObject[] = [{ cwd: host.directory.path }, { cwd: host.directory.path, mcpServers: [] }, { cwd: host.directory.path, mcpServers: [{ name: "teamrun" }] }];
    for (const [index, params] of opened.entries()) {
      const started = new StartedProcess();
      const output = new PassThrough();
      const errors = new PassThrough();
      const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS,
        host.timer, MessageFraming.Lines, tree);
      client.start();
      started.attach(index + 1, new PassThrough(), output, errors, () => Promise.resolve());
      const session = client.request(Resources.acpSessionNew, params, null).catch(() => undefined);
      output.end();
      errors.end();
      started.end(0, null);
      await session;
      await client.stop();
    }

    Assert.areEqual(JSON.stringify([3]), JSON.stringify(swept));
  }

  @TestMethod
  public async failsItsPendingRequestOnceTheAgentsClosedInputRefusesItsWrite(): Promise<void> {
    await using host = new CopilotTestHost();
    const started = new StartedProcess();
    const input = new Writable({ write: (_chunk, _encoding, callback) => callback(Object.assign(new Error("write EPIPE"), { code: "EPIPE" })) });
    const output = new PassThrough();
    const errors = new PassThrough();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer);
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    try {
      const failure = await Assert.throwsAsync(() => client.request("initialize", {}, null), AcpConnectionException);

      Assert.areEqual(Resources.acpDisconnected, failure.message);
      Assert.isTrue(started.stdin.destroyed);
    }
    finally {
      output.end();
      errors.end();
      started.end(0, null);
      await client.stop();
    }
  }

  @TestMethod
  public async boundsShutdownWhenTheProcessCannotBeTerminated(): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.ignores = true;
    const timings = AcpClientTests.TIMINGS;
    const timer = new ManualTimer();
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1" }, host.directory.path, host.programs.wrap(new NodeProcessStarter(terminator)), timings, timer);
    client.start();
    try {
      await client.request("initialize", {}, null);
      let settled = false;
      let failure: unknown;
      const stopped = client.stop().then(
        () => { settled = true; },
        error => { settled = true; failure = error; });

      timer.advance(timings.stopGrace - 1);
      await AcpClientTests.settleAsync();
      Assert.areEqual(0, terminator.calls);
      timer.advance(1);
      await AcpClientTests.settleAsync();
      Assert.areEqual(1, terminator.calls);
      Assert.areEqual(1, timer.pending);
      timer.advance(timings.killWait - 1);
      await AcpClientTests.settleAsync();
      Assert.isFalse(settled);
      timer.advance(1);
      await stopped;

      Assert.areEqual(1, terminator.calls);
      Assert.isInstanceOf(failure, Error);
      Assert.areEqual(Resources.acpDidNotStop, failure.message);
    }
    finally {
      terminator.ignores = false;
      const stopped = client.stop().catch(() => undefined);
      timer.advance(timings.stopGrace);
      await stopped;
    }
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("invalid")
  @TestData("oversize")
  public async retainsTheProtocolFailureWhenInitialTerminationFails(mode: string): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.failures = 1;
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1", TEAMRUN_FAKE_ACP_INIT: mode }, host.directory.path, host.programs.wrap(new NodeProcessStarter(terminator)), host.stayOpenTimings, host.timer);
    client.start();
    try {
      await Assert.throwsAsync(() => client.request("initialize", {}, null), Error);
      await terminator.called;
    }
    finally { await client.stop(); }
  }

  @TestMethod
  public async failsPendingRequestsWhenTheAgentClosesItsInputPipe(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1" }, host.directory.path, host.programs.wrap(host.starter), host.stayOpenTimings, host.timer);
    client.start();
    try {
      await client.request("fixture/null", {}, null);
      await client.request("fixture/close-input", {});
      await Assert.throwsAsync(() => client.request("initialize", { padding: "x".repeat(1024 * 1024) }), Error);
    }
    finally { await client.stop(); }
  }

  @TestMethod
  public async isConnectedOnlyWhileTheAgentRunsAndIsNotStopping(): Promise<void> {
    await using host = new GrokTestHost();
    const crashed = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    Assert.isFalse(crashed.isConnected);
    crashed.start();
    try {
      Assert.isTrue(crashed.isConnected);
      await Assert.throwsAsync(() => crashed.request("session/load", { sessionId: "crash", cwd: host.directory.path, mcpServers: [] }, null), Error);
      Assert.isFalse(crashed.isConnected);
    }
    finally { await crashed.stop(); }
    const stopped = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    stopped.start();
    await stopped.stop();
    Assert.isFalse(stopped.isConnected);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async boundsRequestsAndClosesPendingWork(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    await Assert.throwsAsync(() => client.request("initialize", {}), Error);
    await client.stop();
    const active = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1" }, host.directory.path, host.programs.wrap(host.starter), host.stayOpenTimings, host.timer);
    active.start();
    try {
      Assert.throws(() => active.start(), Error);
      await active.request("initialize", {}, null);
      const timeout = await Assert.throwsAsync(() => active.request("fixture/wait", {}, 1), Error);
      Assert.isTrue(timeout.message.includes("in time"));
      const pending = Array.from({ length: Resources.acpMaximumPending }, () => active.request("fixture/wait", {}, null).catch(error => error));
      await Assert.throwsAsync(() => active.request("fixture/wait", {}), Error);
      await active.stop();
      Assert.isTrue((await Promise.all(pending)).every(t => t instanceof Error));
      Assert.areEqual(host.programs.started.length, host.programs.ended.length);
      await Assert.throwsAsync(() => active.request("initialize", {}), Error);
    }
    finally { await active.stop(); }
  }

  @TestMethod
  public async rejectsAnAgentThatWritesInvalidJson(): Promise<void> {
    Assert.isInstanceOf(await AcpClientTests.initializeFailureAsync("invalid", null), JsonException);
  }

  @TestMethod
  public async rejectsAnAgentThatExceedsTheMessageSizeLimit(): Promise<void> {
    Assert.areEqual(Resources.acpFrameTooLarge, (await AcpClientTests.initializeFailureAsync("oversize", null)).message);
  }

  @TestMethod
  public async timesOutAnAgentThatNeverAnswers(): Promise<void> {
    const failure = await AcpClientTests.initializeFailureAsync("hang", 1);

    Assert.isInstanceOf(failure, TimeoutException);
    Assert.areEqual(Resources.formatAcpTimeout("initialize"), failure.message);
  }

  @TestMethod
  public async rejectsUnownedReverseRequestsAndIgnoresUnmatchedReplies(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    client.start();
    try {
      await client.request("fixture/null", {}, null);
      await client.request("fixture/reverse", {});
      Assert.isNull(await client.request("fixture/null", {}));
      const coded = await Assert.throwsAsync(() => client.request("fixture/unknown", {}), AcpRequestException);
      const uncoded = await Assert.throwsAsync(() => client.request("fixture/fail-without-code", {}), AcpRequestException);
      Assert.areEqual("Unknown method", coded.message);
      Assert.areEqual(-32601, coded.code);
      Assert.areEqual("No code", uncoded.message);
      Assert.isNull(uncoded.code);
      let notifications = 0;
      const reverse = Promise.withResolvers<JsonValue>();
      const listener: IAcpClientListener = { onRequest: () => reverse.promise,
        onNotificationAsync: () => {
          notifications++;
          return Promise.resolve();
        }, onResponseAsync: () => Promise.resolve(), onExitAsync: () => Promise.resolve() };
      client.setListener(listener);
      await client.request("fixture/emit", { messages: [{ jsonrpc: "2.0", id: "unmatched", result: {} }, { jsonrpc: "2.0", id: 9999, result: {} },
        { jsonrpc: "2.0", method: "notice" }, { jsonrpc: "2.0", id: "repeated", method: "reverse" }, { jsonrpc: "2.0", id: "repeated", method: "reverse" }] });
      Assert.areEqual(1, notifications);
      reverse.reject(new Error("unsupported"));
      listener.onNotificationAsync = () => { throw "invalid notification"; };
      await Assert.throwsAsync(() => client.request("fixture/emit", { messages: [{ jsonrpc: "2.0", method: "notice" }] }), Error);
    }
    finally { await client.stop(); }
  }

  @TestMethod
  public async handsTheListenerEachResponsesObjectResultOrNull(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    const responses: string[] = [];
    client.setListener({ onRequest: () => Promise.resolve(null), onNotificationAsync: () => Promise.resolve(), onExitAsync: () => Promise.resolve(),
      onResponseAsync: (method, result) => {
        responses.push(`${method}:${JSON.stringify(result?.toJson() ?? null)}`);
        return Promise.resolve();
      } });
    client.start();
    try {
      await client.request("fixture/emit", { messages: [] }, null);
      await client.request("fixture/null", {}, null);
    }
    finally { await client.stop(); }

    Assert.areEqual("fixture/emit:{}|fixture/null:null", responses.join("|"));
  }

  @TestMethod
  public async readsAMessageWhoseLineEndsInALaterWrite(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    const received: string[] = [];
    client.setListener({ onRequest: () => Promise.resolve(null), onResponseAsync: () => Promise.resolve(), onExitAsync: () => Promise.resolve(),
      onNotificationAsync: (method, params) => {
        received.push(`${method}:${params.readString("text")}`);
        return Promise.resolve();
      } });
    client.start();
    try { await client.request("fixture/split", {}, null); }
    finally { await client.stop(); }

    Assert.areEqual(2, received.length);
    Assert.areEqual(`first:${"x".repeat(256 * 1024)}`, received[0]);
    Assert.areEqual("second:after", received[1]);
  }

  @TestMethod
  public async refusesAGatedRequestItCantHandOnOrAnswerAndAnswersOthersWithAnError(): Promise<void> {
    await using host = new GrokTestHost();
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    input.on("finish", () => {
      output.end();
      errors.end();
      started.end(0, null);
    });
    const gate = new GrokToolGate();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.programs.wrap({ start: () => started }), AcpClientTests.TIMINGS, host.timer,
      MessageFraming.Lines, null, gate);
    const held = Promise.withResolvers<JsonValue>();
    client.setListener(new HeldAcpClientListener(held.promise, []));
    client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    const lines: string[] = [];
    let buffered = String.empty;
    input.on("data", (chunk: Buffer) => {
      const parts = `${buffered}${chunk.toString("utf8")}`.split("\n");
      buffered = parts.pop() ?? String.empty;
      lines.push(...parts);
    });
    const answersAsync = async (count: number): Promise<readonly string[]> => {
      while (lines.length < count)
        await once(input, "data");
      return lines.splice(0, count);
    };
    const hook = "x.ai/hooks/run";
    const send = (id: string, method: string): void => {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params: {} })}\n`);
    };
    const refused = (id: string): string => JSON.stringify({ jsonrpc: "2.0", id, result: gate.answer(Resources.acpGatedRequestRefused) });
    const opened = Array.from({ length: Resources.acpMaximumPending }, (_, index) => `open-${index}`);
    try {
      for (const id of opened)
        send(id, hook);
      send("past", hook);
      send("plain", "session/request_permission");
      const pastCap = await answersAsync(2);
      held.resolve(null);
      const released = await answersAsync(Resources.acpMaximumPending);
      const repeated = Promise.withResolvers<JsonValue>();
      client.setListener(new HeldAcpClientListener(repeated.promise, ["broken", "unknown"]));
      send("twice", hook);
      send("twice", hook);
      send("broken", hook);
      send("unknown", "fixture/unknown");
      const failed = await answersAsync(3);
      repeated.resolve(null);
      const answered = await answersAsync(1);

      Assert.areEqual(refused("past"), pastCap[0]);
      Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: "plain", error: { code: Resources.acpUnsupportedCode, message: Resources.acpTooManyRequests } }), pastCap[1]);
      Assert.areEqual(opened.map(id => JSON.stringify({ jsonrpc: "2.0", id, result: null })).join("|"), released.join("|"));
      Assert.areEqual([refused("twice"), refused("broken"),
        JSON.stringify({ jsonrpc: "2.0", id: "unknown", error: { code: Resources.acpUnsupportedCode, message: Resources.acpUnsupportedRequest } })].join("|"), failed.join("|"));
      Assert.areEqual(JSON.stringify({ jsonrpc: "2.0", id: "twice", result: null }), answered[0]);
    }
    finally {
      await client.stop();
    }
  }

  private static async initializeFailureAsync(mode: string, timeout: number | null): Promise<Error> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_INIT: mode }, host.directory.path, host.programs.wrap(host.starter), host.timings, host.timer);
    client.start();
    try { return await Assert.throwsAsync(() => client.request("initialize", {}, timeout), Error); }
    finally { await client.stop(); }
  }

  private static settleAsync(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }
}
