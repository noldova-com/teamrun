/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SignInLinkPayload } from "@noldova/teamrun.protocol";

@TestClass
export class SignInLinkPayloadTests {
  private static readonly json: object = { providerId: "acct-1", url: "https://auth.example.com/oauth/authorize?state=1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = SignInLinkPayload.fromJson(SignInLinkPayloadTests.json);

    Assert.areEqual(JSON.stringify(SignInLinkPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("acct-1", value.providerId);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new SignInLinkPayload(String.empty, "https://auth.example.com"), ArgumentException);
    Assert.throws(() => new SignInLinkPayload("acct-1", " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => SignInLinkPayload.fromJson({ providerId: "acct-1", url: 4 }), JsonException);

    Assert.areEqual("$.url", exception.path);
  }
}
