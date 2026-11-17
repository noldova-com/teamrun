/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, ProviderIdentity, Resources } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderIdentityTests {
  @TestMethod
  public keepsOnlyTheKnownParts(): void {
    const identity = new ProviderIdentity("person@example.com", undefined, "Noldova");

    Assert.areEqual("person@example.com", identity.email);
    Assert.isUndefined(identity.plan);
    Assert.areEqual("Noldova", identity.organization);
    Assert.isUndefined(identity.authMethod);
    Assert.areEqual("{\"email\":\"person@example.com\",\"organization\":\"Noldova\"}", JSON.stringify(identity.toJson()));
  }

  @TestMethod
  public anEmptyIdentityIsAnEmptyObject(): void {
    Assert.areEqual("{}", JSON.stringify(new ProviderIdentity().toJson()));
    Assert.areEqual("{}", JSON.stringify(ProviderIdentity.fromJson({}).toJson()));
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const identity = ProviderIdentity.fromJson({ email: "a@b.c", plan: "pro", organization: "Org", authMethod: "oauth" });

    Assert.areEqual("a@b.c", identity.email);
    Assert.areEqual("pro", identity.plan);
    Assert.areEqual("Org", identity.organization);
    Assert.areEqual("oauth", identity.authMethod);
    Assert.areEqual("{\"email\":\"a@b.c\",\"plan\":\"pro\",\"organization\":\"Org\",\"authMethod\":\"oauth\"}", JSON.stringify(identity.toJson()));
  }

  @TestMethod
  public carriesAUserNameWhereTheProviderReportsNoEmail(): void {
    const identity = ProviderIdentity.fromJson({ authMethod: "user", userName: "octocat" });

    Assert.areEqual("octocat", identity.userName);
    Assert.areEqual("octocat", identity.account);
    Assert.areEqual("{\"authMethod\":\"user\",\"userName\":\"octocat\"}", JSON.stringify(identity.toJson()));
    Assert.areEqual("a@b.c", new ProviderIdentity("a@b.c", undefined, undefined, undefined, "octocat").account);
    Assert.isUndefined(new ProviderIdentity(undefined, "pro").account);
  }

  @TestMethod
  public describesTheAccountOrSaysASignedInProviderReportedNone(): void {
    const described = [
      ProviderIdentity.describeAccount(AuthStatus.LoggedIn, new ProviderIdentity("a@b.c")),
      ProviderIdentity.describeAccount(AuthStatus.LoggedIn, new ProviderIdentity(undefined, undefined, undefined, "user", "octocat")),
      ProviderIdentity.describeAccount(AuthStatus.LoggedIn, new ProviderIdentity(undefined, "pro")),
      ProviderIdentity.describeAccount(AuthStatus.LoggedIn, null)
    ];

    Assert.areEqual(["a@b.c", "octocat", "Account not reported", "Account not reported"].join(","), described.join(","));
    Assert.areEqual("Account not reported", Resources.accountNotReported);
    for (const status of [AuthStatus.LoggedOut, AuthStatus.Expired, AuthStatus.Error, AuthStatus.Unknown])
      Assert.isNull(ProviderIdentity.describeAccount(status, null));
  }

  @TestMethod
  public rejectsNullPartsWithTheirPath(): void {
    Assert.areEqual("$.identity.plan", Assert.throws(() => ProviderIdentity.fromJson({ plan: null }, "$.identity"), JsonException).path);
    Assert.areEqual("$.identity.userName", Assert.throws(() => ProviderIdentity.fromJson({ userName: 7 }, "$.identity"), JsonException).path);
  }
}
