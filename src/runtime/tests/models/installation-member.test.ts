/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Endpoint, InstallationMember, InstallationRole, InstallationUpdate, InstallationUpdatePhase } from "@noldova/teamrun-runtime";

@TestClass
export class InstallationMemberTests {
  @TestMethod
  public keepsCapabilitiesPrivateAndValidatesPersistedIdentities(): void {
    const starting = new InstallationMember("id", InstallationRole.Desktop, 1, "/data", "1", null, null);
    Assert.isNull(InstallationMember.fromJson(starting.toJson()).endpoint);
    const ready = starting.withEndpoint(Endpoint.tcp(123), "test-token");
    Assert.areEqual(JSON.stringify(ready.toJson()), JSON.stringify(InstallationMember.fromJson(ready.toJson()).toJson()));
    Assert.throws(() => new InstallationMember("x", InstallationRole.Runtime, 1, "/data", "1", null, "token"), Error);
    Assert.throws(() => new InstallationMember("x", InstallationRole.Runtime, 1, "/data", "1", Endpoint.tcp(1), " "), Error);
    Assert.throws(() => InstallationMember.fromJson({ ...ready.toJson(), role: "unknown" }), Error);
    const update = new InstallationUpdate("op", "id", "2", InstallationUpdatePhase.Preparing, 100);
    Assert.areEqual(JSON.stringify(update.toJson()), JSON.stringify(InstallationUpdate.fromJson(update.toJson()).toJson()));
    Assert.throws(() => new InstallationUpdate("", "id", "2", InstallationUpdatePhase.Preparing, 100), Error);
    Assert.throws(() => InstallationUpdate.fromJson({ ...update.toJson(), expiresAt: -1 }), Error);
  }
}
