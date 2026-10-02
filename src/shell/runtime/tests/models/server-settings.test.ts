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
import { ServerSettings } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ServerSettingsTests {
  @TestMethod
  public defaultsToTheProtocolLimits(): void {
    const settings = new ServerSettings();

    Assert.areEqual(16 * 1024 * 1024, settings.maximumFrameLength);
    Assert.areEqual(5_000, settings.handshakeTimeout);
    Assert.areEqual(600_000, settings.defaultRequestTimeout);
    Assert.areEqual(3_600_000, settings.maximumRequestTimeout);
  }

  @TestMethod
  public keepsTheGivenLimits(): void {
    const settings = new ServerSettings(1_024, 100, 200, 200);

    Assert.areEqual(1_024, settings.maximumFrameLength);
    Assert.areEqual(100, settings.handshakeTimeout);
    Assert.areEqual(200, settings.defaultRequestTimeout);
    Assert.areEqual(200, settings.maximumRequestTimeout);
  }

  @TestMethod
  public rejectsLimitsThatAreNotPositiveIntegers(): void {
    Assert.areEqual("maximumFrameLength", Assert.throws(() => new ServerSettings(0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("handshakeTimeout", Assert.throws(() => new ServerSettings(1, 0.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("defaultRequestTimeout", Assert.throws(() => new ServerSettings(1, 1, -1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("maximumRequestTimeout", Assert.throws(() => new ServerSettings(1, 1, 1, 0), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsADefaultLongerThanTheMaximum(): void {
    const exception = Assert.throws(() => new ServerSettings(1, 1, 201, 200), ArgumentOutOfRangeException);

    Assert.areEqual("defaultRequestTimeout", exception.parameterName);
    Assert.areEqual(201, exception.actualValue);
  }
}
