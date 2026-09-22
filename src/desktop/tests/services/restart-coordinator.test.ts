/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RestartCoordinator, UpdateParticipant } from "@noldova/teamrun-desktop";
import { Endpoint, InstallationMember, InstallationRole, InvalidOperationException, RuntimeService, RuntimeTimings } from "@noldova/teamrun-runtime";
import { MethodName } from "@noldova/teamrun-protocol";

import { RestartFixture } from "../fixtures/restart-fixture.fixture.js";

@TestClass
export class RestartCoordinatorTests {
  @TestMethod
  public async failedBackupOrLostLeaseLeavesTheWorkspaceOpenAndNeverInstalls(): Promise<void> {
    for (const lostLease of [false, true]) {
      await using fixture = new RestartFixture();
      const owner = await fixture.addDesktop("one");
      let installed = false;
      const coordinator = new RestartCoordinator(fixture.registry, owner.member, fixture, () => undefined, async (_directory, id) => {
        if (lostLease) fixture.registry.release(id);
        else throw new Error("Fixture disk full");
      });
      await Assert.throwsAsync(() => coordinator.install("2.0.0", async () => { installed = true; }), Error);
      Assert.isFalse(installed);
      Assert.isFalse(fixture.bridges[0]!.checkpoint.isFrozen);
      Assert.areEqual(0, fixture.reopened.length);
      Assert.doesNotThrow(() => fixture.registry.assertLaunchAllowed());
    }
  }

  @TestMethod
  public async savesTwoDesktopsStopsBothRuntimesAndBacksUpBeforeInstallerHandoff(): Promise<void> {
    await using fixture = new RestartFixture();
    const owner = await fixture.addDesktop("one");
    await fixture.addDesktop("two");
    const first = await fixture.addRuntime("one");
    const second = await fixture.addRuntime("two");
    const backups: string[] = [];
    const permits: boolean[] = [];
    const coordinator = new RestartCoordinator(fixture.registry, owner.member, fixture, t => permits.push(t), async (directory, id) => {
      const path = await RuntimeService.createRecoveryCopy(directory, id);
      if (path) backups.push(path);
    });
    let installed = 0;
    await coordinator.install("2.0.0", async () => {
      installed += 1;
      Assert.areEqual(2, backups.length);
      Assert.isTrue(backups.every(t => existsSync(t)));
      Assert.isTrue(fixture.waited.includes(first.processId));
      Assert.isTrue(fixture.waited.includes(second.processId));
      Assert.areEqual(1, fixture.registry.members().length);
      Assert.throws(() => fixture.registry.assertLaunchAllowed(), InvalidOperationException);
    });
    Assert.areEqual(1, installed);
    Assert.areEqual("true", permits.join(","));
    Assert.areEqual(0, fixture.reopened.length);
    await owner.dispose();
    fixture.registry.register(new InstallationMember("new-version", InstallationRole.Desktop, process.pid, fixture.directory.resolve("one"),
      "2.0.0", Endpoint.tcp(1), "test"));
    Assert.doesNotThrow(() => fixture.registry.assertLaunchAllowed());
  }

  @TestMethod
  public async failedDraftCheckpointResumesTheRuntimeAndNeverCallsTheInstaller(): Promise<void> {
    await using fixture = new RestartFixture();
    const owner = await fixture.addDesktop("one");
    const runtime = await fixture.addRuntime("one");
    fixture.bridges[0]!.ready = false;
    const coordinator = new RestartCoordinator(fixture.registry, owner.member, fixture, () => undefined, async () => undefined);
    let installed = false;
    await Assert.throwsAsync(() => coordinator.install("2.0.0", async () => { installed = true; }), Error);
    Assert.isFalse(installed);
    Assert.isFalse(fixture.bridges[0]!.checkpoint.isFrozen);
    Assert.doesNotThrow(() => fixture.registry.assertLaunchAllowed());
    const connection = await UpdateParticipant.connect(runtime, RuntimeTimings.createDefault());
    try { Assert.isFalse((await connection.client.call(MethodName.ProviderList, null)).hasErrors); }
    finally { connection.client.close(); }
  }

  @TestMethod
  public async installerLaunchFailureReleasesTheGateAndReopensClosedWorkspaces(): Promise<void> {
    await using fixture = new RestartFixture();
    const owner = await fixture.addDesktop("one");
    await fixture.addDesktop("two");
    const permits: boolean[] = [];
    const coordinator = new RestartCoordinator(fixture.registry, owner.member, fixture, t => permits.push(t), async () => undefined);
    await Assert.throwsAsync(() => coordinator.install("2.0.0", () => Promise.reject(new Error("fixture installer failed"))), Error);
    Assert.areEqual("true,false", permits.join(","));
    Assert.areEqual(1, fixture.reopened.length);
    Assert.isFalse(fixture.bridges[0]!.checkpoint.isFrozen);
    Assert.doesNotThrow(() => fixture.registry.assertLaunchAllowed());
  }
}
