/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, PreShellData } from "@noldova/teamrun-shell-protocol";

@TestClass
export class PreShellDataTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"location\":\"/home/person/.noldova/teamrun\"}";

    Assert.areEqual(text, JSON.stringify(new PreShellData("/home/person/.noldova/teamrun").toJson()));
    Assert.areEqual("/home/person/.noldova/teamrun", PreShellData.fromJson(JSON.parse(text)).location);
  }

  @TestMethod
  public travelsAsTheDetailsOfItsFailure(): void {
    const failure = new Failure(FailureCode.PreShellData, "This data folder holds data of an older TeamRun.", new PreShellData("D:\\data").toJson());

    Assert.areEqual(
      "{\"code\":\"PreShellData\",\"message\":\"This data folder holds data of an older TeamRun.\",\"details\":{\"location\":\"D:\\\\data\"}}",
      JSON.stringify(failure.toJson()));
    Assert.areEqual("D:\\data", PreShellData.fromJson(Failure.fromJson(failure.toJson()).details).location);
  }

  @TestMethod
  public rejectsABlankLocationOrUnknownFields(): void {
    Assert.throws(() => new PreShellData(" "), ArgumentException);
    Assert.areEqual("$.location", Assert.throws(() => PreShellData.fromJson({ location: "" }), JsonException).path);
    Assert.areEqual("$.size", Assert.throws(() => PreShellData.fromJson({ location: "x", size: 1 }), JsonException).path);
  }
}
