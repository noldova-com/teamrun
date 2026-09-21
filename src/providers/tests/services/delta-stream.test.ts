/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeltaStream } from "@noldova/teamrun-providers";
import { DetailKind } from "@noldova/teamrun-protocol";

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
    await Wait.until(() => listener.details.length === 2);

    Assert.isFalse(stream.isPending);
    Assert.areEqual("Hello", listener.details[0]?.text);
    Assert.areEqual("a", listener.details[0]?.providerItemId);
    Assert.areEqual(DetailKind.Reasoning, listener.details[1]?.kind);
    stream.append("a", DetailKind.Text, "!");
    stream.flush();
    Assert.areEqual("Hello!", listener.details[2]?.text);
    await Wait.delay(40);
    Assert.areEqual(3, listener.details.length);
  }

  @TestMethod
  public skipsBlankTextAndForgottenItems(): void {
    const listener = new RecordingTurnListener();
    const stream = new DeltaStream(listener, 1000);

    stream.append("blank", DetailKind.Text, "  ");
    stream.append("gone", DetailKind.Text, "text");
    stream.forget("gone");
    stream.flush();
    stream.flush();

    Assert.areEqual(0, listener.details.length);
    Assert.throws(() => new DeltaStream(listener, 0), ArgumentOutOfRangeException);
  }
}
