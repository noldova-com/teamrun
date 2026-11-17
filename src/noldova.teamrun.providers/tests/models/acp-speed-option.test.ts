/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderSpeed } from "@noldova/teamrun.protocol";
import { AcpConfigOption, AcpSpeedOption } from "@noldova/teamrun.providers";

@TestClass
export class AcpSpeedOptionTests {
  private static readonly standard: ProviderSpeed = new ProviderSpeed("standard", "Standard");
  private static readonly fast: ProviderSpeed = new ProviderSpeed("fast", "Fast");

  @TestMethod
  public findsTheOptionWithItsIdThatOffersEveryChoiceAndMapsSpeedsToChoicesBothWays(): void {
    const speed = new AcpSpeedOption("fast", [[AcpSpeedOptionTests.standard, "false"], [AcpSpeedOptionTests.fast, "true"]]);
    const offered = new AcpConfigOption("fast", "model", "false", ["false", "true"], ["false", "true"]);
    const partial = new AcpConfigOption("fast", "model", "off", ["off", "true"], ["Off", "On"]);
    const other = new AcpConfigOption("ultra", "model", "false", ["false", "true"], ["false", "true"]);

    Assert.isTrue(speed.find([other, partial, offered]) === offered);
    Assert.isUndefined(speed.find([other, partial]));
    Assert.areEqual("true|false|null", [speed.valueOf("fast"), speed.valueOf("standard"), String(speed.valueOf("ultra"))].join("|"));
    Assert.areEqual("fast|standard|null", [speed.speedOf("true"), speed.speedOf("false"), String(speed.speedOf("on"))].join("|"));
    Assert.areEqual("fast|null", `${speed.servedIn([other, offered.withValue("true")])}|${String(speed.servedIn([partial]))}`);
    Assert.areEqual("standard,fast|false,true", `${speed.speeds.map(t => t.id).join(",")}|${speed.values.join(",")}`);
  }

  @TestMethod
  public refusesABlankIdNoSpeedsAndTwoSpeedsSetByOneChoice(): void {
    Assert.areEqual("id", Assert.throws(() => new AcpSpeedOption(" ", [[AcpSpeedOptionTests.standard, "false"]]), ArgumentException).parameterName);
    Assert.areEqual("choices|choices", [
      () => new AcpSpeedOption("fast", []),
      () => new AcpSpeedOption("fast", [[AcpSpeedOptionTests.standard, "true"], [AcpSpeedOptionTests.fast, "true"]])
    ].map(t => Assert.throws(t, ArgumentException).parameterName).join("|"));
    Assert.areEqual("standard", new AcpSpeedOption("fast", [[AcpSpeedOptionTests.standard, "false"]]).speedOf("false"));
  }
}
