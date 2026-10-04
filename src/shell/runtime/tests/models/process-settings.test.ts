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
import { ProcessSettings } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ProcessSettingsTests {
  @TestMethod
  public givesAProgramThreeSecondsToExitAndKilledProgramsFiveToEndAndSeesRunningProgramsEveryFive(): void {
    const settings = new ProcessSettings();

    Assert.areEqual(3_000, settings.graceMilliseconds);
    Assert.areEqual(5_000, settings.endMilliseconds);
    Assert.areEqual(5_000, settings.seenMilliseconds);
  }

  @TestMethod
  public keepsTheGivenTimes(): void {
    const settings = new ProcessSettings(10, 20, 30);

    Assert.areEqual(10, settings.graceMilliseconds);
    Assert.areEqual(20, settings.endMilliseconds);
    Assert.areEqual(30, settings.seenMilliseconds);
  }

  @TestMethod
  public rejectsTimesThatAreNotPositiveIntegers(): void {
    Assert.areEqual("graceMilliseconds", Assert.throws(() => new ProcessSettings(0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("endMilliseconds", Assert.throws(() => new ProcessSettings(1, 1.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("seenMilliseconds", Assert.throws(() => new ProcessSettings(1, 1, -1), ArgumentOutOfRangeException).parameterName);
  }
}
