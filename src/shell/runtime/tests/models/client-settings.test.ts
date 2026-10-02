/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ClientSettings } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ClientSettingsTests {
  @TestMethod
  public defaultsToTheProtocolLimits(): void {
    const settings = new ClientSettings();

    Assert.areEqual(5_000, settings.handshakeTimeout);
    Assert.areEqual(600_000, settings.callTimeout);
    Assert.areEqual(5_000, settings.answerGrace);
    Assert.areEqual(16 * 1024 * 1024, settings.maximumFrameLength);
  }

  @TestMethod
  public keepsTheGivenLimits(): void {
    const settings = new ClientSettings(10, 20, 30, 40);

    Assert.areEqual(10, settings.handshakeTimeout);
    Assert.areEqual(20, settings.callTimeout);
    Assert.areEqual(30, settings.answerGrace);
    Assert.areEqual(40, settings.maximumFrameLength);
  }

  @TestMethod
  public rejectsLimitsThatAreNotPositiveIntegers(): void {
    Assert.areEqual("handshakeTimeout", Assert.throws(() => new ClientSettings(0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("callTimeout", Assert.throws(() => new ClientSettings(1, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("answerGrace", Assert.throws(() => new ClientSettings(1, 1, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("maximumFrameLength", Assert.throws(() => new ClientSettings(1, 1, 1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
