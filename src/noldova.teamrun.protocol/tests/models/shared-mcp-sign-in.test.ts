/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpSignIn } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpSignInTests {
  private static readonly reference = "teamrun.mcpSignIn0123456789abcdef0123456789abcdef";

  @TestMethod
  public keepsWhereItsTokensAreAndWhenTheyExpireOrWhySignInIsNeededAgain(): void {
    const json = { reference: SharedMcpSignInTests.reference, expiresAt: "2026-11-02T10:00:00.000Z", needsSignIn: null, updatedAt: "2026-11-02T09:00:00.000Z" };
    const expired = { ...json, expiresAt: null, needsSignIn: "The server refused the refresh." };

    for (const value of [json, expired])
      Assert.areEqual(JSON.stringify(value), JSON.stringify(SharedMcpSignIn.fromJson(value).toJson()));
    Assert.areEqual("$.s.updatedAt", Assert.throws(() => SharedMcpSignIn.fromJson({ ...json, updatedAt: 1 }, "$.s"), JsonException).path);
  }

  @TestMethod
  public refusesAReferenceOfAnotherFormABlankReasonOrABlankTime(): void {
    for (const reference of ["teamrun.mcpSecret0123456789abcdef0123456789abcdef", "teamrun.mcpSignIn0123", "teamrun.mcpSignIn0123456789ABCDEF0123456789abcdef"])
      Assert.areEqual("reference", Assert.throws(() => new SharedMcpSignIn(reference, null, null, "a"), ArgumentException).parameterName, reference);
    Assert.areEqual("needsSignIn", Assert.throws(() => new SharedMcpSignIn(SharedMcpSignInTests.reference, null, " ", "a"), ArgumentException).parameterName);
    Assert.areEqual("updatedAt", Assert.throws(() => new SharedMcpSignIn(SharedMcpSignInTests.reference, null, null, " "), ArgumentException).parameterName);
  }
}
