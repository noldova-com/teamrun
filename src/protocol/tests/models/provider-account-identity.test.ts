/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderAccountIdentity } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderAccountIdentityTests {
  @TestMethod
  public keepsOnlyTheKnownParts(): void {
    const identity = new ProviderAccountIdentity("ross@example.com", undefined, "Noldova");

    Assert.areEqual("ross@example.com", identity.email);
    Assert.isUndefined(identity.plan);
    Assert.areEqual("Noldova", identity.organization);
    Assert.isUndefined(identity.authMethod);
    Assert.areEqual("{\"email\":\"ross@example.com\",\"organization\":\"Noldova\"}", JSON.stringify(identity.toJson()));
  }

  @TestMethod
  public anEmptyIdentityIsAnEmptyObject(): void {
    Assert.areEqual("{}", JSON.stringify(new ProviderAccountIdentity().toJson()));
    Assert.areEqual("{}", JSON.stringify(ProviderAccountIdentity.fromJson({}).toJson()));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const identity = ProviderAccountIdentity.fromJson({ email: "a@b.c", plan: "pro", organization: "Org", authMethod: "oauth" });

    Assert.areEqual("a@b.c", identity.email);
    Assert.areEqual("pro", identity.plan);
    Assert.areEqual("Org", identity.organization);
    Assert.areEqual("oauth", identity.authMethod);
    Assert.areEqual("{\"email\":\"a@b.c\",\"plan\":\"pro\",\"organization\":\"Org\",\"authMethod\":\"oauth\"}", JSON.stringify(identity.toJson()));
  }

  @TestMethod
  public rejectsNullPartsWithTheirPath(): void {
    Assert.areEqual("$.identity.plan", Assert.throws(() => ProviderAccountIdentity.fromJson({ plan: null }, "$.identity"), JsonException).path);
  }
}
