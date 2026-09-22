/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Endpoint, InstallationRegistry, InstallationMember, InstallationRole, InstallationUpdate, InstallationUpdatePhase,
  InvalidOperationException, ProcessProbe } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class InstallationRegistryTests {
  @TestMethod
  public serializesRegistrationAgainstPreparationAndPreservesInstallerOwnership(): void {
    using directory = new TemporaryDirectory();
    const probe = new ProcessProbe();
    probe.isAlive = pid => pid !== 99;
    const registry = new InstallationRegistry(directory.resolve("scope", "instances.db"), probe);
    const data = directory.resolve("data");
    const owner = new InstallationMember("owner", InstallationRole.Desktop, 1, data, "1", Endpoint.tcp(1), "token");
    const runtime = new InstallationMember("runtime", InstallationRole.Runtime, 2, data, "1", null, null);
    registry.register(owner);
    registry.register(runtime);
    const operation = new InstallationUpdate("op", "owner", "2", InstallationUpdatePhase.Preparing, Date.now() + 60_000);
    Assert.throws(() => registry.begin(operation), InvalidOperationException);
    registry.activate(runtime.withEndpoint(Endpoint.tcp(2), "token"));
    Assert.areEqual(2, registry.begin(operation).length);
    Assert.throws(() => registry.begin(operation), InvalidOperationException);
    Assert.throws(() => registry.register(new InstallationMember("new", InstallationRole.Runtime, 3, data, "1", null, null)), InvalidOperationException);
    Assert.throws(() => registry.assertLaunchAllowed(), InvalidOperationException);
    registry.renew(new InstallationUpdate("op", "owner", "2", InstallationUpdatePhase.Preparing, Date.now() + 90_000));
    Assert.isTrue(registry.ownsUpdate("op"));
    Assert.isTrue(registry.isPreparing("op"));
    Assert.isFalse(registry.isInstalling("op"));
    Assert.throws(() => registry.renew(new InstallationUpdate("op", "other", "2", InstallationUpdatePhase.Preparing, Date.now() + 90_000)), InvalidOperationException);
    registry.release("unrelated");
    Assert.isTrue(registry.isPreparing("op"));
    registry.markInstalling("op");
    Assert.isTrue(registry.isInstalling("op"));
    Assert.isFalse(registry.isPreparing("op"));
    Assert.throws(() => registry.renew(operation), InvalidOperationException);
    const updated = new InstallationMember("updated", InstallationRole.Desktop, 3, data, "2", Endpoint.tcp(3), "token");
    Assert.throws(() => registry.register(updated), InvalidOperationException);
    registry.unregister("owner");
    Assert.throws(() => registry.register(new InstallationMember("runtime2", InstallationRole.Runtime, 4, data, "2", null, null)), InvalidOperationException);
    registry.register(updated);
    Assert.doesNotThrow(() => registry.assertLaunchAllowed());
    registry.register(new InstallationMember("dead", InstallationRole.Desktop, 99, data, "1", null, null));
    Assert.isFalse(registry.members().some(t => t.id === "dead"));
    Assert.throws(() => registry.activate(owner), InvalidOperationException);
    Assert.throws(() => registry.markInstalling("expired"), InvalidOperationException);
  }

  @TestMethod
  public async expiresAbandonedPreparationsAndReleasesADepartingOwner(): Promise<void> {
    using directory = new TemporaryDirectory();
    const registry = new InstallationRegistry(directory.resolve("scope", "instances.db"));
    const owner = new InstallationMember("owner", InstallationRole.Desktop, process.pid, directory.resolve("data"), "1", Endpoint.tcp(1), "t");
    registry.register(owner);
    Assert.throws(() => registry.begin(new InstallationUpdate("bad", "missing", "2", InstallationUpdatePhase.Preparing, Date.now() + 1000)), Error);
    Assert.throws(() => registry.begin(new InstallationUpdate("bad", "owner", "2", InstallationUpdatePhase.Installing, Date.now() + 1000)), Error);
    registry.begin(new InstallationUpdate("expires", "owner", "2", InstallationUpdatePhase.Preparing, Date.now() + 30));
    await Wait.delay(60);
    Assert.isFalse(registry.ownsUpdate("expires"));
    registry.begin(new InstallationUpdate("released", "owner", "2", InstallationUpdatePhase.Preparing, Date.now() + 1000));
    registry.release("released");
    Assert.isFalse(registry.ownsUpdate("released"));
    Assert.doesNotThrow(() => registry.assertLaunchAllowed());
    registry.begin(new InstallationUpdate("op", "owner", "2", InstallationUpdatePhase.Preparing, Date.now() + 1000));
    registry.unregister("owner");
    Assert.doesNotThrow(() => registry.assertLaunchAllowed());
    Assert.isFalse(registry.isPreparing("op"));
  }

  @TestMethod
  public derivesPrivateInstallationPathsAndRejectsArbitraryDataDirectoryLinks(): void {
    using directory = new TemporaryDirectory();
    Assert.isNull(InstallationRegistry.forEntry(directory.resolve("source.ts"), process.execPath, directory.path));
    const registry = InstallationRegistry.forEntry(directory.resolve("resources", "app.asar", "main.js"), process.execPath, directory.path);
    Assert.isNotNull(registry);
    if (process.platform === "win32")
      Assert.areEqual(registry.path, InstallationRegistry.forEntry(directory.resolve("resources", "app.asar", "main.js"),
        process.execPath.toUpperCase(), directory.path)?.path);
    const data = directory.resolve("data");
    Assert.isNull(InstallationRegistry.forDataDirectory(data, directory.path));
    registry.linkDataDirectory(data);
    Assert.areEqual(registry.path, InstallationRegistry.forDataDirectory(data, directory.path)?.path);
    writeFileSync(directory.resolve("data", "installation.id"), "../../outside");
    Assert.throws(() => InstallationRegistry.forDataDirectory(data, directory.path), InvalidOperationException);
    Assert.throws(() => new InstallationRegistry(directory.resolve("bad", "instances.db")).linkDataDirectory(data), InvalidOperationException);
    const blocked = directory.resolve("file");
    writeFileSync(blocked, "not a directory");
    Assert.throws(() => new InstallationRegistry(directory.resolve("file", "instances.db")).members(), Error);
    Assert.isFalse(existsSync(directory.resolve("outside")));
  }
}
