/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeltaStream } from "@noldova/teamrun.providers";
import { DetailKind } from "@noldova/teamrun.protocol";

import { RecordingTurnListener } from "../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class DeltaStreamTests {
  @TestMethod
  public async reportsAccumulatedTextOncePerIntervalUnderTheItemId(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stream = new DeltaStream(listener, 20);

    stream.append("a", DetailKind.Text, "Hel");
    stream.append("a", DetailKind.Text, "lo");
    stream.append("b", DetailKind.Reasoning, "hmm");
    Assert.isTrue(stream.isPending);
    Assert.areEqual(0, listener.details.length);
    await Wait.until(() => listener.details.length === 2, "The listener did not see 2 details.");

    Assert.isFalse(stream.isPending);
    Assert.areEqual("Hello", listener.details[0]?.text);
    Assert.areEqual("a", listener.details[0]?.providerItemId);
    Assert.areEqual(DetailKind.Reasoning, listener.details[1]?.kind);
    stream.append("a", DetailKind.Text, "!");
    await stream.flushAsync();
    Assert.areEqual("Hello!", listener.details[2]?.text);
    await Wait.delay(40);
    Assert.areEqual(3, listener.details.length);
  }

  @TestMethod
  public async skipsBlankTextAndForgottenItems(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stream = new DeltaStream(listener, 1000);

    stream.append("blank", DetailKind.Text, "  ");
    stream.append("gone", DetailKind.Text, "text");
    stream.forget("gone");
    await stream.flushAsync();
    await stream.flushAsync();

    Assert.areEqual(0, listener.details.length);
    Assert.throws(() => new DeltaStream(listener, 0), ArgumentOutOfRangeException);
  }

  @TestMethod
  public async reportsTheNextItemOnlyOnceTheListenerReturnedFromTheLast(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stream = new DeltaStream(listener, 1000);
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;

    stream.append("a", DetailKind.Text, "first");
    const first = stream.flushAsync();
    stream.append("b", DetailKind.Text, "second");
    const second = stream.flushAsync();
    await Wait.until(() => listener.details.length === 1, "The listener did not see the first detail.");
    const whileHeld = listener.details.map(t => t.text);
    held.resolve();
    await Promise.all([first, second]);

    Assert.areEqual(JSON.stringify(["first"]), JSON.stringify(whileHeld));
    Assert.areEqual(JSON.stringify(["first", "second"]), JSON.stringify(listener.details.map(t => t.text)));
    Assert.areEqual(JSON.stringify(["first", "second"]), JSON.stringify(listener.finishedDetails.map(t => t.text)));
  }

  @TestMethod
  public async failsTheNextFlushWithAFailureOfAReportTheIntervalStartedAndReportsWhatFollows(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stream = new DeltaStream(listener, 1);
    let failures = 1;
    listener.onDetailAsync = (detail): Promise<void> => {
      listener.details.push(detail);
      return failures-- > 0 ? Promise.reject(new Error("The listener failed.")) : Promise.resolve();
    };

    stream.append("a", DetailKind.Text, "lost");
    await Wait.until(() => listener.details.length === 1, "The interval did not report the detail.");
    stream.append("b", DetailKind.Text, "kept");
    const failure = await Assert.throwsAsync(() => stream.flushAsync(), Error);
    await stream.flushAsync();

    Assert.areEqual("The listener failed.", failure.message);
    Assert.areEqual(JSON.stringify(["lost", "kept"]), JSON.stringify(listener.details.map(t => t.text)));
  }
}
