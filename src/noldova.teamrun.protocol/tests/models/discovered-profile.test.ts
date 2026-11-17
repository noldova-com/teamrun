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
import { AuthStatus, DiscoveredProfile, ProviderIdentity } from "@noldova/teamrun.protocol";

@TestClass
export class DiscoveredProfileTests {
  private static readonly json: object = {
    kind: "codex", profileDir: "/home/person/.codex-work", label: "codex-work", usual: false, authStatus: "LoggedIn",
    identity: { email: "person@example.com", plan: "Pro" }
  };

  @TestMethod
  public roundTripsThroughJsonWithItsIdentityOrNone(): void {
    const value = DiscoveredProfile.fromJson(DiscoveredProfileTests.json);
    const usual = new DiscoveredProfile("claude", "/home/person/.claude", "Claude Code", true, AuthStatus.Unknown);

    Assert.areEqual("codex /home/person/.codex-work codex-work false LoggedIn person@example.com",
      [value.kind, value.profileDir, value.label, value.usual, value.authStatus, value.identity?.email].join(" "));
    Assert.areEqual(JSON.stringify(value.toJson()), JSON.stringify(DiscoveredProfile.fromJson(value.toJson()).toJson()));
    Assert.isNull(usual.identity);
    Assert.areEqual(JSON.stringify(usual.toJson()), JSON.stringify(DiscoveredProfile.fromJson(usual.toJson()).toJson()));
    Assert.isTrue(DiscoveredProfile.fromJson(usual.toJson()).usual);
    Assert.areEqual("person@example.com", new DiscoveredProfile("codex", "/p", "p", false, AuthStatus.LoggedIn, new ProviderIdentity("person@example.com")).identity?.email);
  }

  @TestMethod
  public takesOnlyFilledNamesAndAKnownStatus(): void {
    const refused = [() => new DiscoveredProfile(" ", "/p", "p", false, AuthStatus.Unknown), () => new DiscoveredProfile("codex", "", "p", false, AuthStatus.Unknown),
      () => new DiscoveredProfile("codex", "/p", " ", false, AuthStatus.Unknown)].map(t => Assert.throws(t, ArgumentException).parameterName);

    Assert.areEqual("kind,profileDir,label", refused.join(","));
    Assert.areEqual("$.authStatus", Assert.throws(() => DiscoveredProfile.fromJson({ ...DiscoveredProfileTests.json, authStatus: "Maybe" }), JsonException).path);
    Assert.areEqual("$.usual", Assert.throws(() => DiscoveredProfile.fromJson({ ...DiscoveredProfileTests.json, usual: "yes" }), JsonException).path);
    Assert.areEqual("$.identity.email", Assert.throws(() => DiscoveredProfile.fromJson({ ...DiscoveredProfileTests.json, identity: { email: 1 } }), JsonException).path);
  }
}
