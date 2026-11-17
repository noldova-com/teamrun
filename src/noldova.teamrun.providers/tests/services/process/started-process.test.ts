/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { PassThrough, Writable } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StartedProcess } from "@noldova/teamrun.providers";

@TestClass
export class StartedProcessTests {
  @TestMethod
  public async passesInputAndOutputThroughOnceAttachedAndClosesAfterTheEnd(): Promise<void> {
    const started = new StartedProcess();
    const input = new PassThrough();
    const output = new PassThrough();
    const events: string[] = [];
    started.on("spawn", () => events.push("spawn"));
    started.on("exit", (code: number | null, signal: string | null) => events.push(`exit ${code} ${signal}`));
    let read = "";
    started.stdout.setEncoding("utf8");
    started.stdout.on("data", (chunk: string) => read += chunk);
    started.stdin.write("before start");

    started.attach(42, input, output, new PassThrough(), () => Promise.resolve());
    input.setEncoding("utf8");
    const [written] = await once(input, "data");
    output.end("answer");
    await once(started.stdout, "end");
    const closed = once(started, "close");
    started.end(0, null);
    const [code, signal] = await closed;

    Assert.areEqual("before start", written);
    Assert.areEqual("answer", read);
    Assert.areEqual("spawn,exit 0 null", events.join(","));
    Assert.areEqual(0, code);
    Assert.isNull(signal);
    Assert.areEqual(42, started.pid);
    Assert.areEqual(0, started.exitCode);
    Assert.isNull(started.signalCode);
    Assert.isTrue(started.hasExited);
    Assert.isTrue(started.stdin.destroyed);
  }

  @TestMethod
  public async closesOnlyOnceTheOutputBeingReadHasEnded(): Promise<void> {
    const started = new StartedProcess();
    const output = new PassThrough();
    started.attach(42, new PassThrough(), output, new PassThrough(), () => Promise.resolve());
    started.stdout.resume();
    let isClosed = false;
    started.once("close", () => isClosed = true);

    started.end(1, null);
    await new Promise(resolve => setImmediate(resolve));
    const wasClosedEarly = isClosed;
    const closed = once(started, "close");
    output.end();
    await closed;

    Assert.isFalse(wasClosedEarly);
    Assert.isTrue(isClosed);
  }

  @TestMethod
  public async stopsOnceStartedWhenAskedBeforeAndNotAgainAfterTheEnd(): Promise<void> {
    const started = new StartedProcess();
    let stops = 0;
    const stopped = started.stopAsync();

    started.attach(7, new PassThrough(), new PassThrough(), new PassThrough(), () => {
      stops++;
      return Promise.resolve();
    });
    await stopped;
    const stopsBeforeKill = stops;
    const killed = started.kill("SIGKILL");
    started.end(null, "SIGTERM");
    await started.stopAsync();

    Assert.areEqual(1, stopsBeforeKill);
    Assert.isTrue(killed);
    Assert.isTrue(started.killed);
    Assert.areEqual(2, stops);
    Assert.isNull(started.exitCode);
    Assert.areEqual("SIGTERM", started.signalCode);
  }

  @TestMethod
  public async passesAFailedStopToItsWaiterAndKillIgnoresIt(): Promise<void> {
    const started = new StartedProcess();
    const stopped = started.stopAsync();

    started.attach(7, new PassThrough(), new PassThrough(), new PassThrough(), () => Promise.reject(new Error("The fixture cannot stop.")));

    await Assert.throwsAsync(() => stopped, Error);
    Assert.isTrue(started.kill());
    await new Promise(resolve => setImmediate(resolve));
    Assert.isFalse(started.hasExited);
  }

  @TestMethod
  public async reportsAStartThatFailedEndsAWaitingStopAndClosesWithItsOutputEnded(): Promise<void> {
    const started = new StartedProcess();
    const errors: string[] = [];
    started.on("error", (error: Error) => errors.push(error.message));
    const stopped = started.stopAsync();
    started.stdout.resume();

    started.fail(new Error("not found"));
    await stopped;
    started.fail(new Error("again"));
    const closed = once(started, "close");
    started.end(-2, null);
    await closed;

    Assert.areEqual("not found,again", errors.join(","));
    Assert.isUndefined(started.pid);
    Assert.areEqual(-2, started.exitCode);
  }

  @TestMethod
  public async hasEndedAfterAStartThatFailedAndEndedWithoutAnExitCodeSoAStopAfterItReturns(): Promise<void> {
    const started = new StartedProcess();
    const events: string[] = [];
    const closed = Promise.withResolvers<void>();
    started.on("error", (error: Error) => events.push(`error ${error.message}`));
    started.on("close", (code: number | null, signal: string | null) => {
      events.push(`close ${code} ${signal}`);
      closed.resolve();
    });

    started.fail(new Error("refused"));
    started.end(null, null);
    await closed.promise;

    Assert.areEqual("error refused,close null null", events.join(","));
    Assert.isTrue(started.hasExited);
    await started.stopAsync();
  }

  @TestMethod
  public async destroysItsInputWithTheErrorOfTheProgramsInput(): Promise<void> {
    const started = new StartedProcess();
    const input = new PassThrough();
    started.attach(1, input, new PassThrough(), new PassThrough(), () => Promise.resolve());
    const failed = once(started.stdin, "error");

    input.emit("error", new Error("The fixture input closed."));
    const [error] = await failed;

    Assert.areEqual("The fixture input closed.", (error as Error).message);
    Assert.isTrue(started.stdin.destroyed);
  }

  @TestMethod
  public async outlivesAWriteThatTheProgramsClosedInputRefusesWhenNoConsumerListensForItsError(): Promise<void> {
    const started = new StartedProcess();
    const input = new Writable({ write: (_chunk, _encoding, callback) => callback(Object.assign(new Error("write EPIPE"), { code: "EPIPE" })) });
    started.attach(1, input, new PassThrough(), new PassThrough(), () => Promise.resolve());
    const closed = new Promise(resolve => started.stdin.once("close", resolve));

    started.stdin.write("ping\n");
    await closed;

    Assert.isTrue(started.stdin.destroyed);
    Assert.areEqual("write EPIPE", started.stdin.errored?.message);
  }
}
