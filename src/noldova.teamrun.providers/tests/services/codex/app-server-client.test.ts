/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, ObservedSettings } from "@noldova/teamrun.protocol";
import { AppServerClient, AppServerException, AppServerUnavailableException, CodexItemReader, CodexTurn, DeltaStream, type INotificationHandler, ProcessCommand,
  type ProcessExit, Resources, StartedProcess } from "@noldova/teamrun.providers";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { FailingDetailTurnListener } from "../../fixtures/failing-detail-turn-listener.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class AppServerClientTests {
  @TestMethod
  public async initializesRequestsAndStops(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const versionBeforeStart = client.version;
    const processBeforeStart = client.processId;

    const initialization = await client.start();
    const processId = client.processId;
    const empty = await client.request("test/empty", {}, 1000);
    const models = JSON.stringify(await client.request("model/list", {}, 1000));
    const unknown = await Assert.throwsAsync(() => client.request("nope", {}, 1000), AppServerException);
    const timedOut = await Assert.throwsAsync(() => client.request("test/never", {}, 50), AppServerUnavailableException);
    const twice = await Assert.throwsAsync(() => client.start(), AppServerUnavailableException);
    await client.stop();
    await client.stop();
    Assert.isNull(client.processId);
    const afterStop = await Assert.throwsAsync(() => client.request("model/list", {}, 100), AppServerUnavailableException);
    client.notify("ignored", {});
    const exit = await client.waitForExit();

    Assert.isNull(versionBeforeStart);
    Assert.isNull(processBeforeStart);
    Assert.isTrue(Number.isInteger(processId) && processId! > 0 && processId !== process.pid);
    Assert.isNull(empty);
    Assert.areEqual("9.9.9", initialization.version);
    Assert.areEqual("9.9.9", client.version);
    Assert.areEqual("codex-cli/9.9.9 (fake)", client.initialization?.userAgent);
    Assert.isTrue(models.includes("gpt-5.6-sol"));
    Assert.areEqual("nope: unknown method nope (code -32601)", unknown.message);
    Assert.areEqual("The Codex app-server did not answer test/never within the timeout.", timedOut.message);
    Assert.areEqual("The Codex app-server was already started.", twice.message);
    Assert.areEqual("The Codex app-server is not running (model/list).", afterStop.message);
    Assert.isFalse(client.isAlive);
    Assert.areEqual(0, exit.code);
  }

  @TestMethod
  public async routesNotificationsAndServerRequests(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const methods: string[] = [];
    let answers: string | null = null;
    const recorder = AppServerClientTests.createHandler((method, params) => {
      methods.push(method);
      if (method === "item/completed" && params.readObject("item").readString("id") === "answers")
        answers = params.readObject("item").readString("text");
    });
    const throwing = AppServerClientTests.createHandler(() => {
      throw new Error("handler failure");
    });
    client.setServerRequestHandler({
      handleServerRequest: (method: string): Promise<JsonValue> =>
        method === "item/tool/requestUserInput" ? Promise.resolve({ answers: {} }) : Promise.reject(new Error("refused"))
    });
    await client.start();
    const subscription = client.subscribe(recorder);
    client.subscribe(throwing);

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "approve" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"), "The client did not get turn/completed.");
    subscription[Symbol.dispose]();
    const later: string[] = [];
    client.subscribe(AppServerClientTests.createHandler(method => { later.push(method); }));
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "fail" }] }, 1000);
    await Wait.until(() => later.includes("turn/completed"), "The client did not get the later turn/completed.");
    await client.stop();

    const decoded = JSON.parse(String(answers)) as { result: unknown; error: { code: number; message: string } | null }[];
    Assert.areEqual(9, decoded.length);
    Assert.areEqual("refused", decoded[0]?.error?.message);
    Assert.areEqual(-32000, decoded[0]?.error?.code);
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(decoded[4]?.result));
    Assert.areEqual(1, methods.filter(t => t === "turn/completed").length);
    Assert.isTrue(client.handlerFailureCount > 0);
    Assert.isFalse(subscription.isActive);
  }

  @TestMethod
  public async notesAHandlersFailureInTheReplyItWasSubscribedFor(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const client = AppServerClientTests.createLoggingClient(host, log);
    const listener = new RecordingTurnListener();
    const methods: string[] = [];
    client.subscribe(AppServerClientTests.createHandler(method => { methods.push(method); }));
    client.subscribe(AppServerClientTests.createHandler(() => {
      throw new Error("handler failure");
    }), listener);
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "complete" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"), "The client did not get turn/completed.");
    await client.settledAsync();
    await client.stop();

    Assert.isTrue(new Set(methods).size < methods.length);
    Assert.areEqual(JSON.stringify([...new Set(methods)].map(t => [DetailKind.Note, Resources.formatCodexNotificationFailed(t, "handler failure")])),
      JSON.stringify(listener.details.map(t => [t.kind, t.text])));
    Assert.areEqual(methods.length, client.handlerFailureCount);
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public async logsAHandlersFailureWithoutAReplyOrWhoseReplyFailsToNoteIt(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const client = AppServerClientTests.createLoggingClient(host, log);
    const failing = new FailingDetailTurnListener();
    const methods: string[] = [];
    client.subscribe(AppServerClientTests.createHandler(method => { methods.push(method); }));
    client.subscribe(AppServerClientTests.createHandler(() => {
      throw new Error("unsubscribed failure");
    }));
    client.subscribe(AppServerClientTests.createHandler(() => {
      throw new Error("noted failure");
    }), failing);
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "complete" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"), "The client did not get turn/completed.");
    await client.settledAsync();
    await client.stop();

    Assert.areEqual(JSON.stringify(methods.flatMap(t => [
      Resources.formatCodexNotificationFailed(t, "unsubscribed failure"),
      Resources.formatCodexNotificationFailed(t, "noted failure")
    ])), JSON.stringify(log.lines));
    Assert.areEqual(methods.length, failing.details.length);
    Assert.areEqual(2 * methods.length, client.handlerFailureCount);
  }

  @TestMethod
  public async answersNothingToARequestTheServerWithdraws(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const signals: AbortSignal[] = [];
    let report: string | null = null;
    client.setServerRequestHandler({
      handleServerRequest: (method: string, _params: JsonReader, signal: AbortSignal): Promise<JsonValue> => {
        signals.push(signal);
        return method === "item/tool/requestUserInput"
          ? Promise.resolve({ answers: {} })
          : new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("withdrawn")), { once: true }));
      }
    });
    client.subscribe(AppServerClientTests.createHandler((method, params) => {
      if (method === "item/completed" && params.readObject("item").readString("id") === "withdrawn")
        report = params.readObject("item").readString("text");
    }));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "withdraw" }] }, 1000);
    await Wait.until(() => report !== null, "The client did not report the withdrawn question.");
    await client.stop();

    Assert.areEqual(JSON.stringify({ isAnswered: false, next: { result: { answers: {} }, error: null } }), String(report));
    Assert.areEqual(2, signals.length);
    Assert.isTrue(signals[0]?.aborted ?? false);
    Assert.isFalse(signals[1]?.aborted ?? true);
  }

  @TestMethod
  public async handsATurnTheNextNotificationOnlyAfterItsListenerTookTheLastOne(): Promise<void> {
    using host = new CodexTestHost();
    const started = new StartedProcess();
    const output = new PassThrough();
    const errors = new PassThrough();
    const client = new AppServerClient(host.command, host.environment, host.clientInfo, host.programs.wrap({ start: () => started }), host.timings);
    const listener = new RecordingTurnListener();
    const turn = new CodexTurn("t-1", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    const hold = Promise.withResolvers<void>();
    listener.heldDetail = hold.promise;
    client.subscribe(turn, listener);
    const starting = client.start();
    started.attach(7, new PassThrough(), output, errors, () => Promise.resolve());
    output.write(`${JSON.stringify({ id: 1, result: { userAgent: "codex/1.0.0" } })}\n`);
    await starting;

    const probe = client.request("test/probe", {}, 5000);
    output.write([
      { method: "item/completed", params: { threadId: "t-1", turnId: "u-1", item: { id: "first", type: "agentMessage", text: "First" } } },
      { method: "item/completed", params: { threadId: "t-1", turnId: "u-1", item: { id: "second", type: "agentMessage", text: "Second" } } },
      { method: "turn/completed", params: { threadId: "t-1", turn: { id: "u-1", status: "completed" } } },
      { id: 2, result: {} }
    ].map(t => `${JSON.stringify(t)}\n`).join(""));
    await probe;
    await Wait.until(() => listener.details.length > 0, "The turn did not report the first message.");
    const whileHeld = [listener.details.map(t => t.text), listener.finishedDetails.map(t => t.text), turn.isComplete];
    hold.resolve();
    await turn.waitForCompletion();
    await client.settledAsync();
    output.end();
    errors.end();
    started.end(0, null);
    await client.waitForExit();

    Assert.areEqual(JSON.stringify([["First"], [], false]), JSON.stringify(whileHeld));
    Assert.areEqual(JSON.stringify(["First", "Second"]), JSON.stringify(listener.details.map(t => t.text)));
    Assert.areEqual(JSON.stringify(["First", "Second"]), JSON.stringify(listener.finishedDetails.map(t => t.text)));
    Assert.areEqual(0, client.handlerFailureCount);
  }

  @TestMethod
  public async runsWorkInOrderAndGoesOnAfterAWorkThatFailsLeavingItsFailureToTheCaller(): Promise<void> {
    using host = new CodexTestHost();
    const client = new AppServerClient(host.command, host.environment, host.clientInfo, host.programs.wrap({ start: () => new StartedProcess() }), host.timings);
    const failure = new Error("The work failed.");
    const ran: string[] = [];

    const failed = client.runInOrderAsync(() => {
      ran.push("first");
      return Promise.reject(failure);
    });
    const next = client.runInOrderAsync(() => {
      ran.push("second");
      return Promise.resolve();
    });
    const thrown = await Assert.throwsAsync(() => failed, Error);
    await next;
    await client.settledAsync();

    Assert.areEqual(failure, thrown);
    Assert.areEqual("first,second", ran.join(","));
    Assert.areEqual(0, client.handlerFailureCount);
  }

  @TestMethod
  public async answersARequestWhoseHandlerThrowsWithTheErrorAndCountsAndLogsAnExitHandlerThatFails(): Promise<void> {
    using host = new CodexTestHost();
    const started = new StartedProcess();
    const input = new PassThrough();
    const written: string[] = [];
    input.on("data", (chunk: Buffer) => written.push(...chunk.toString().split("\n").filter(t => t.length > 0)));
    const output = new PassThrough();
    const errors = new PassThrough();
    const log = new RecordingLog();
    const client = new AppServerClient(host.command, host.environment, host.clientInfo, host.programs.wrap({ start: () => started }), host.timings, log);
    const methods: string[] = [];
    const exits: (number | null)[] = [];
    client.subscribe({ handleNotificationAsync: (method: string): Promise<void> => {
      methods.push(method);
      return Promise.resolve();
    } });
    client.setServerRequestHandler({ handleServerRequest: (): Promise<JsonValue> => {
      throw new Error("The request handler broke.");
    } });
    client.subscribeExit({ handleExitAsync: (): Promise<void> => Promise.reject(new Error("The exit handler failed.")) });
    client.subscribeExit({ handleExitAsync: (exit: ProcessExit): Promise<void> => {
      exits.push(exit.code);
      return Promise.resolve();
    } });
    const starting = client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    output.write(`${JSON.stringify({ id: 1, result: { userAgent: "codex/1.0.0" } })}\n`);
    await starting;

    const probe = client.request("test/probe", {}, 5000);
    output.write([
      { id: "s-1", method: "item/tool/requestUserInput", params: { threadId: "t-1" } },
      { method: "turn/started", params: { threadId: "t-1", turn: { id: "u-1" } } },
      { id: 2, result: {} }
    ].map(t => `${JSON.stringify(t)}\n`).join(""));
    await probe;
    await client.settledAsync();
    const requestFailures = client.handlerFailureCount;
    output.end();
    errors.end();
    started.end(0, null);
    await client.waitForExit();
    await client.settledAsync();

    const answer = JsonReader.parse(written.find(t => t.startsWith(JSON.stringify({ id: "s-1" }).slice(0, -1))) ?? "{}");
    Assert.areEqual(0, requestFailures);
    Assert.areEqual(Resources.serverRequestFailedCode, answer.readObject("error").readInteger("code"));
    Assert.isTrue(answer.readObject("error").readString("message").includes("The request handler broke."));
    Assert.areEqual(JSON.stringify(["turn/started"]), JSON.stringify(methods));
    Assert.areEqual(1, client.handlerFailureCount);
    Assert.areEqual(JSON.stringify(["The exit handler failed."]), JSON.stringify(log.lines));
    Assert.areEqual(JSON.stringify([0]), JSON.stringify(exits));
  }

  @TestMethod
  public async countsAFailureTheLogCantTakeAndHandsOnTheNextNotification(): Promise<void> {
    using host = new CodexTestHost();
    const started = new StartedProcess();
    const output = new PassThrough();
    const log = new RecordingLog();
    const record = log.write.bind(log);
    let refused = false;
    log.write = message => {
      if (refused) {
        record(message);
        return;
      }
      refused = true;
      throw new Error("The log is full.");
    };
    const client = new AppServerClient(host.command, host.environment, host.clientInfo, host.programs.wrap({ start: () => started }), host.timings, log);
    const methods: string[] = [];
    client.subscribe({ handleNotificationAsync: (method: string): Promise<void> => {
      methods.push(method);
      return method === "turn/started" ? Promise.reject(new Error("The handler broke.")) : Promise.resolve();
    } });
    const starting = client.start();
    started.attach(7, new PassThrough(), output, new PassThrough(), () => Promise.resolve());
    output.write(`${JSON.stringify({ id: 1, result: { userAgent: "codex/1.0.0" } })}\n`);
    await starting;

    const probe = client.request("test/probe", {}, 5000);
    output.write([
      { method: "turn/started", params: { threadId: "t-1", turn: { id: "u-1" } } },
      { method: "turn/completed", params: { threadId: "t-1", turn: { id: "u-1" } } },
      { id: 2, result: {} }
    ].map(t => `${JSON.stringify(t)}\n`).join(""));
    await probe;
    await client.settledAsync();

    Assert.areEqual(JSON.stringify(["turn/started", "turn/completed"]), JSON.stringify(methods));
    Assert.areEqual(2, client.handlerFailureCount);
    Assert.areEqual(1, log.lines.length);
    Assert.isTrue(log.lines[0]?.includes("The log is full.") ?? false);
  }

  @TestMethod
  public async declinesServerRequestsWithoutAHandler(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    let answers: string | null = null;
    client.subscribe(AppServerClientTests.createHandler((method, params) => {
      if (method === "item/completed")
        answers = params.readObject("item").readString("text");
    }));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "approve" }] }, 1000);
    await Wait.until(() => answers !== null, "The client did not answer the question.");
    await client.stop();

    const decoded = JSON.parse(String(answers)) as { error: { code: number; message: string } | null }[];
    Assert.areEqual(9, decoded.filter(t => t.error?.code === -32601).length);
    Assert.areEqual("TeamRun has no handler for server requests.", decoded[0]?.error?.message);
  }

  @TestMethod
  public async ignoresLinesItCannotRead(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const methods: string[] = [];
    client.subscribe(AppServerClientTests.createHandler(method => methods.push(method)));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "garbage" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"), "The client did not get turn/completed.");
    await client.settledAsync();
    await client.stop();

    Assert.areEqual(2, client.droppedLineCount);
    Assert.areEqual(2, methods.filter(t => t === "thread/started").length);
    Assert.areEqual(3, methods.filter(t => t === "item/completed").length);
    Assert.areEqual(0, client.handlerFailureCount);
  }

  @TestMethod
  public async readsALineLongerThanOneRead(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const texts: string[] = [];
    client.subscribe(AppServerClientTests.createHandler((method, params) => {
      if (method === "item/completed")
        texts.push(params.readObject("item").readString("text"));
    }));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "long" }] }, 1000);
    await Wait.until(() => texts.length > 0, "The client got no text.");
    await client.stop();

    Assert.areEqual("x".repeat(256 * 1024), texts[0]);
    Assert.areEqual(0, client.droppedLineCount);
  }

  @TestMethod
  public async failsPendingRequestsWhenTheServerExits(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_STDERR: "1" });
    const exits: number[] = [];
    client.subscribeExit({
      handleExitAsync: (exit: ProcessExit): Promise<void> => {
        exits.push(exit.code ?? -1);
        return Promise.resolve();
      }
    });
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    const pending = Assert.throwsAsync(() => client.request("test/never", {}, 5000), AppServerUnavailableException);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "exit" }] }, 1000);
    const failure = await pending;
    const exit = await client.waitForExit();
    await client.settledAsync();

    Assert.areEqual("The Codex app-server exited (code 1, signal null): fake stderr line\n", failure.message);
    Assert.areEqual(1, exit.code);
    Assert.areEqual("1", exits.join(","));
    Assert.isTrue(client.stderr.includes("fake stderr line"));
  }

  @TestMethod
  public async reportsInitializationFailures(): Promise<void> {
    using host = new CodexTestHost();
    const refusing = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "fail" });
    const exiting = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "exit" });
    const missing = host.createClient(host.environment, new ProcessCommand("teamrun-no-such-executable", ["app-server"]));

    const refused = await Assert.throwsAsync(() => refusing.start(), AppServerException);
    const exited = await Assert.throwsAsync(() => exiting.start(), AppServerUnavailableException);
    const unspawnable = await Assert.throwsAsync(() => missing.start(), AppServerUnavailableException);
    await refusing.stop();

    Assert.areEqual("initialize: init failed (code -32000)", refused.message);
    Assert.areEqual("{\"detail\":\"x\"}", JSON.stringify(refused.error.data));
    Assert.isTrue(exited.message.startsWith("The Codex app-server exited (code 3, signal null)"));
    Assert.isTrue(unspawnable.message.includes("ENOENT"));
    Assert.isFalse(missing.isAlive);
    Assert.areNotEqual(0, (await missing.waitForExit()).code);
  }

  @TestMethod
  public async failsStartWithTheExitOfAServerWhoseClosedInputRefusedTheFirstRequest(): Promise<void> {
    using host = new CodexTestHost();
    const started = new StartedProcess();
    const input = new Writable({ write: (_chunk, _encoding, callback) => callback(Object.assign(new Error("write EPIPE"), { code: "EPIPE" })) });
    const output = new PassThrough();
    const errors = new PassThrough();
    const client = new AppServerClient(host.command, host.environment, host.clientInfo, host.programs.wrap({ start: () => started }), host.timings);

    const starting = client.start();
    started.attach(7, input, output, errors, () => Promise.resolve());
    await once(input, "error");
    errors.end("Error: the CLI package version does not match its executable\n");
    output.end();
    started.end(1, null);
    const failure = await Assert.throwsAsync(() => starting, AppServerUnavailableException);

    Assert.isTrue(started.stdin.destroyed);
    Assert.isTrue(failure.message.startsWith("The Codex app-server exited (code 1, signal null)"), failure.message);
    Assert.isTrue(failure.message.includes("does not match its executable"), failure.message);
    Assert.isFalse(client.isAlive);
  }

  @TestMethod
  public async terminatesAServerThatIgnoresTheClosedInput(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_IGNORE_STDIN_END: "1" }, host.command.withArguments("app-server"), host.stayOpenTimings);
    await client.start();

    await client.stop();
    const exit = await client.waitForExit();

    Assert.isFalse(client.isAlive);
    Assert.isTrue(exit.code !== 0 || exit.signal !== null);
  }

  private static createLoggingClient(host: CodexTestHost, log: RecordingLog): AppServerClient {
    return new AppServerClient(host.command.withArguments("app-server"), host.environment, host.clientInfo, host.programs.wrap(host.starter), host.timings, log);
  }

  private static createHandler(handle: (method: string, params: JsonReader) => void): INotificationHandler {
    return {
      handleNotificationAsync: (method: string, params: JsonReader): Promise<void> => {
        handle(method, params);
        return Promise.resolve();
      }
    };
  }

  private static async startThread(client: { request(method: string, params: JsonValue, timeout: number): Promise<JsonValue> }): Promise<string> {
    const started = await client.request("thread/start", { cwd: "D:/work" }, 1000);
    return String((started as { thread: { id: string } }).thread.id);
  }
}
