/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, DiscoveredProfile, ProviderProfileDiscovery } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderProfileDiscoveryTests {
  @TestMethod
  public keepsItsProfilesInOrderThroughJson(): void {
    const found = new ProviderProfileDiscovery([new DiscoveredProfile("claude", "/home/person/.claude", "Claude Code", true, AuthStatus.LoggedIn),
      new DiscoveredProfile("codex", "/home/person/.codex-work", "codex-work", false, AuthStatus.LoggedOut)]);
    const read = ProviderProfileDiscovery.fromJson(found.toJson());

    Assert.areEqual("/home/person/.claude,/home/person/.codex-work", read.profiles.map(t => t.profileDir).join(","));
    Assert.areEqual(JSON.stringify(found.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual(0, ProviderProfileDiscovery.fromJson({ profiles: [] }).profiles.length);
    Assert.areEqual("$.profiles.0.kind", Assert.throws(() => ProviderProfileDiscovery.fromJson({ profiles: [{}] }), JsonException).path);
  }
}
