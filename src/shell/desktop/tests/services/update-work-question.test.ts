/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QuitChoice, UpdateWorkQuestion } from "@noldova/teamrun-shell-desktop";

import { FakeClock } from "../fixtures/fake-clock.fixture.js";
import { FakeQuitPrompt } from "../fixtures/fake-quit-prompt.fixture.js";

@TestClass
export class UpdateWorkQuestionTests {
  private static readonly INTERVAL: number = 1000;

  private readonly clock: FakeClock = new FakeClock();
  private readonly prompt: FakeQuitPrompt = new FakeQuitPrompt();
  private readonly reads: (readonly string[] | Error)[] = [];

  @TestMethod
  public async goesOnWhenThePersonStopsTheWorkAndIgnoresOtherAnswers(): Promise<void> {
    const question = this.create();
    const stranger = new FakeQuitPrompt();

    const asked = question.askAsync(["A reply (/data/one)"]);
    const answers = [question.answer(stranger, QuitChoice.Stop), question.answer(this.prompt, "Later"), question.answer(this.prompt, QuitChoice.Stop), question.answer(this.prompt, QuitChoice.Cancel)];

    Assert.areEqual(JSON.stringify(["A reply (/data/one)"]), JSON.stringify(await asked));
    Assert.areEqual(JSON.stringify([false, false, true, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["A reply (/data/one) update", "none"]), JSON.stringify(this.prompt.shown));
  }

  @TestMethod
  public async cancelsWhenThePersonCancelsOrTheWindowCannotAsk(): Promise<void> {
    const cancelled = this.create();
    const asked = cancelled.askAsync(["A reply (/data/one)"]);
    cancelled.answer(this.prompt, QuitChoice.Cancel);
    this.prompt.canShow = false;

    const unasked = await this.create().askAsync(["A reply (/data/one)"]);

    Assert.isNull(await asked);
    Assert.isNull(unasked);
    Assert.areEqual(JSON.stringify(["A reply (/data/one) update", "none", "A reply (/data/one) update", "none"]), JSON.stringify(this.prompt.shown));
  }

  @TestMethod
  public async keepsTheListCurrentWhileThePersonWaitsAndGoesOnOnceNoWorkIsLeft(): Promise<void> {
    const question = this.create();
    this.reads.push(["A reply (/data/one)", "A command (/data/two)"], []);
    const asked = question.askAsync(["A reply (/data/one)"]);

    const waits = question.answer(this.prompt, QuitChoice.Wait);
    const waitsAgain = question.answer(this.prompt, QuitChoice.Wait);
    await this.tickAsync();
    await this.tickAsync();

    Assert.areEqual(0, (await asked)?.length);
    Assert.isTrue(waits);
    Assert.isFalse(waitsAgain);
    Assert.areEqual(JSON.stringify([
      "A reply (/data/one) update", "A reply (/data/one) waiting update", "A reply (/data/one)+A command (/data/two) waiting update", "none"
    ]), JSON.stringify(this.prompt.shown));
    Assert.areEqual(0, this.clock.pending);
  }

  @TestMethod
  public async stopsWaitingWhenThePersonCancelsMeanwhile(): Promise<void> {
    const question = this.create();
    const asked = question.askAsync(["A reply (/data/one)"]);
    question.answer(this.prompt, QuitChoice.Wait);

    question.answer(this.prompt, QuitChoice.Cancel);
    await setImmediate();

    Assert.isNull(await asked);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual(0, this.reads.length);
  }

  @TestMethod
  public async agreesToStopTheListShownWhenThePersonStopsWhileWaiting(): Promise<void> {
    const question = this.create();
    this.reads.push(["A reply (/data/one)", "A command (/data/two)"]);
    const asked = question.askAsync(["A reply (/data/one)"]);
    question.answer(this.prompt, QuitChoice.Wait);
    await this.tickAsync();

    question.answer(this.prompt, QuitChoice.Stop);

    Assert.areEqual(JSON.stringify(["A reply (/data/one)", "A command (/data/two)"]), JSON.stringify(await asked));
    Assert.areEqual(0, this.clock.pending);
  }

  @TestMethod
  public async stopsWaitingWithoutShowingTheListAgainWhenThePersonCancelsDuringARead(): Promise<void> {
    const read = Promise.withResolvers<readonly string[]>();
    const question = this.create(() => read.promise);
    const asked = question.askAsync(["A reply (/data/one)"]);
    question.answer(this.prompt, QuitChoice.Wait);
    await this.tickAsync();

    question.answer(this.prompt, QuitChoice.Cancel);
    read.resolve(["A reply (/data/one)"]);
    await setImmediate();

    Assert.isNull(await asked);
    Assert.areEqual(JSON.stringify(["A reply (/data/one) update", "A reply (/data/one) waiting update", "none"]), JSON.stringify(this.prompt.shown));
    Assert.areEqual(0, this.clock.pending);
  }

  @TestMethod
  public async failsWhenTheWorkCannotBeReadWhileThePersonWaits(): Promise<void> {
    const question = this.create();
    this.reads.push(new Error("The runtime did not answer."));
    const asked = question.askAsync(["A reply (/data/one)"]);
    question.answer(this.prompt, QuitChoice.Wait);
    const failure = Assert.throwsAsync(() => asked, Error);

    await this.tickAsync();

    Assert.areEqual("The runtime did not answer.", (await failure).message);
    Assert.areEqual("none", this.prompt.shown.at(-1));
    Assert.isFalse(question.answer(this.prompt, QuitChoice.Stop));
  }

  private async tickAsync(): Promise<void> {
    await setImmediate();
    this.clock.advance(UpdateWorkQuestionTests.INTERVAL);
    await setImmediate();
  }

  private readAsync(): Promise<readonly string[]> {
    const read = this.reads.shift() ?? [];
    return read instanceof Error ? Promise.reject(read) : Promise.resolve(read);
  }

  private create(readWorkAsync: () => Promise<readonly string[]> = () => this.readAsync()): UpdateWorkQuestion {
    return new UpdateWorkQuestion(this.prompt, readWorkAsync, UpdateWorkQuestionTests.INTERVAL, (t, signal) => this.clock.waitAsync(t, signal));
  }
}
