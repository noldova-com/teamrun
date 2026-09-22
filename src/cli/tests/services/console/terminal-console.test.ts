/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalConsole } from "@noldova/teamrun-cli";

import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class TerminalConsoleTests {
  @TestMethod
  public async cancelsOnlyThePendingQuestionWithoutConsumingTheNextLine(): Promise<void> {
    const input = new PassThrough();
    using console = new TerminalConsole(input, new PassThrough(), new PassThrough());
    const controller = new AbortController();
    const cancelled = console.ask("approval", controller.signal);
    controller.abort();
    Assert.isNull(await cancelled);
    input.write("next message\n");
    Assert.isNull(await console.ask("already cancelled", controller.signal));
    Assert.areEqual("next message", await console.ask("next"));
    const active = new AbortController();
    const answered = console.ask("answer", active.signal);
    input.write("yes\n");
    Assert.areEqual("yes", await answered);
    active.abort();
    input.end();
  }

  @TestMethod
  public async writesAndReadsLines(): Promise<void> {
    const input = new PassThrough();
    const output = new PassThrough();
    const errors = new PassThrough();
    const written: string[] = [];
    const failed: string[] = [];
    output.on("data", (chunk: Buffer) => written.push(chunk.toString()));
    errors.on("data", (chunk: Buffer) => failed.push(chunk.toString()));
    using console = new TerminalConsole(input, output, errors);

    console.write("hello");
    console.writeError("oops");
    input.write("first\n");
    await Wait.until(() => true);
    const pending = console.ask("> ");
    const waiting = console.ask("> ");
    input.write("second\n");
    const first = await pending;
    const second = await waiting;
    const afterEnd = console.ask("> ");
    input.end();
    const ended = await afterEnd;
    const late = await console.ask("> ");

    Assert.areEqual("hello\n", written[0]);
    Assert.areEqual("oops\n", failed[0]);
    Assert.areEqual("first", first);
    Assert.areEqual("second", second);
    Assert.isNull(ended);
    Assert.isNull(late);
    Assert.areEqual("> ", written[1]);
  }
}
