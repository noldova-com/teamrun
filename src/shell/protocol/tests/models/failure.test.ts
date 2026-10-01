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
import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";

@TestClass
export class FailureTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const failure = Failure.fromJson(new Failure(FailureCode.NotFound, "Nothing here.").toJson());

    Assert.areEqual(FailureCode.NotFound, failure.code);
    Assert.areEqual("Nothing here.", failure.message);
    Assert.areEqual("{\"code\":\"NotFound\",\"message\":\"Nothing here.\"}", JSON.stringify(failure.toJson()));
  }

  @TestMethod
  public rejectsABlankMessage(): void {
    Assert.throws(() => new Failure(FailureCode.Internal, " "), ArgumentException);
    Assert.areEqual("$.failure.message", Assert.throws(() => Failure.fromJson({ code: "Internal", message: " " }, "$.failure"), JsonException).path);
  }

  @TestMethod
  public rejectsAnUnknownCode(): void {
    Assert.areEqual("$.code", Assert.throws(() => Failure.fromJson({ code: "Gone", message: "Text." }), JsonException).path);
  }
}
