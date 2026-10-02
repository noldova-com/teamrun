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
    Assert.isUndefined(failure.details);
    Assert.areEqual("{\"code\":\"NotFound\",\"message\":\"Nothing here.\"}", JSON.stringify(failure.toJson()));
  }

  @TestMethod
  public roundTripsDetails(): void {
    const failure = Failure.fromJson(new Failure(FailureCode.Conflict, "Work is running.", { descriptions: ["A reply"] }).toJson());

    Assert.areEqual("{\"descriptions\":[\"A reply\"]}", JSON.stringify(failure.details));
    Assert.areEqual("{\"code\":\"Conflict\",\"message\":\"Work is running.\",\"details\":{\"descriptions\":[\"A reply\"]}}", JSON.stringify(failure.toJson()));
  }

  @TestMethod
  public rejectsDetailsThatAreNotAnObject(): void {
    Assert.areEqual("$.details", Assert.throws(() => Failure.fromJson({ code: "Conflict", message: "Text.", details: [1] }), JsonException).path);
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
