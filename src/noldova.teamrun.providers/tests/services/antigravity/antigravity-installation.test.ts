/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rmSync, utimesSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";
import { AntigravityInstallation, AntigravityServer, ExecutableSource, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

class FakeInstaller implements IProviderKindInstallation {
  public readonly unavailable: string | null = "Not on this system.";
  public readonly missingTool: string | null = "unzip";
  public isInstalled: boolean = false;
  public installs: number = 0;
  public readonly checks: boolean[] = [];

  public readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    this.checks.push(checksLatest);
    return Promise.resolve(new ProviderKindVersions(this.isInstalled ? "1.3.0" : null, "1.3.1"));
  }

  public install(progress: (received: number, total: number) => void): Promise<string> {
    this.installs++;
    progress(1, 1);
    return Promise.resolve("installed");
  }
}

@TestClass
export class AntigravityInstallationTests {
  @TestMethod
  public async passesTheInstallersOwnStateAndInstallThrough(): Promise<void> {
    const installer = new FakeInstaller();
    const installation = new AntigravityInstallation(installer, () => null, () => Promise.resolve(null));
    const progress: number[][] = [];

    Assert.areEqual("Not on this system.", installation.unavailable);
    Assert.areEqual("unzip", installation.missingTool);
    Assert.areEqual("installed", await installation.install((received, total) => progress.push([received, total]), new AbortController().signal, () => undefined));
    Assert.areEqual(1, installer.installs);
    Assert.areEqual("1,1", progress.join(";"));
  }

  @TestMethod
  public async passesWhetherToCheckTheLatestToItsInstaller(): Promise<void> {
    const installer = new FakeInstaller();
    const installation = new AntigravityInstallation(installer, () => null, () => Promise.resolve(null));

    await installation.readVersions(false);
    await installation.readVersions(true);

    Assert.areEqual("false,true", installer.checks.join(","));
  }

  @TestMethod
  public async countsACompatiblePathServerOnlyWhileItsOwnCopyIsMissingAndReadsItsVersionOnceUntilItChanges(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("agy_acp_server.exe");
    writeFileSync(path, "server");
    const installer = new FakeInstaller();
    let reads = 0;
    const installation = new AntigravityInstallation(installer, chosen => AntigravityInstallationTests.server(path, chosen, ExecutableSource.Path),
      () => Promise.resolve(++reads === 1 ? "1.3.4" : "2.0.0"));

    Assert.isFalse(installation.isInstalled);
    Assert.isNull(installation.foundPath ?? null);
    const versions = await installation.readVersions(true);
    Assert.areEqual("1.3.4 1.3.1", `${versions.installed} ${versions.latest}`);
    Assert.isTrue(installation.isInstalled);
    Assert.areEqual(path, installation.foundPath ?? null);
    Assert.isNull(installation.notInstalledReason ?? null);
    await installation.readVersions(true);
    Assert.areEqual(1, reads);

    utimesSync(path, new Date(2020, 0, 1), new Date(2020, 0, 1));
    Assert.isNull(installation.foundPath ?? null);
    const changed = await installation.readVersions(true);
    Assert.areEqual(2, reads);
    Assert.isNull(changed.installed);
    Assert.isFalse(installation.isInstalled);
    Assert.areEqual(Resources.formatAntigravityPathUnsupported(path, "2.0.0"), installation.notInstalledReason ?? null);

    installer.isInstalled = true;
    Assert.isTrue(installation.isInstalled);
    Assert.isNull(installation.foundPath ?? null);
    Assert.isNull(installation.notInstalledReason ?? null);
    Assert.areEqual("1.3.0", (await installation.readVersions(true)).installed);
    Assert.areEqual(2, reads);
  }

  @TestMethod
  public async readsAServerWhoseVersionCannotBeReadAsUnsupported(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("agy_acp_server.exe");
    writeFileSync(path, "server");
    const installation = new AntigravityInstallation(new FakeInstaller(), chosen => AntigravityInstallationTests.server(path, chosen, ExecutableSource.Path),
      () => Promise.reject(new Error("The server closed before it answered.")));

    Assert.isNull((await installation.readVersions(true)).installed);
    Assert.isFalse(installation.isInstalled);
    Assert.areEqual(Resources.formatAntigravityPathUnsupported(path, null), installation.notInstalledReason ?? null);
  }

  @TestMethod
  public async forgetsAPathServerOnceItsFileIsGone(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("agy_acp_server.exe");
    writeFileSync(path, "server");
    let reads = 0;
    const installation = new AntigravityInstallation(new FakeInstaller(), chosen => AntigravityInstallationTests.server(path, chosen, ExecutableSource.Path),
      () => Promise.resolve(++reads === 1 ? "1.3.0" : null));
    await installation.readVersions(true);
    Assert.areEqual(path, installation.foundPath ?? null);

    rmSync(path);
    Assert.isNull(installation.foundPath ?? null);
    Assert.isFalse(installation.isInstalled);
    Assert.isNull((await installation.readVersions(true)).installed);
    Assert.areEqual(2, reads);
  }

  @TestMethod
  public async looksOnlyAtAServerFoundOnPath(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("agy_acp_server.exe");
    writeFileSync(path, "server");
    let reads = 0;
    const installation = new AntigravityInstallation(new FakeInstaller(), chosen => AntigravityInstallationTests.server(path, chosen, ExecutableSource.Managed),
      () => Promise.resolve(`1.3.${++reads}`));

    Assert.isNull((await installation.readVersions(true)).installed);
    Assert.areEqual(0, reads);
    Assert.isFalse(installation.isInstalled);
    Assert.isNull(installation.notInstalledReason ?? null);
  }

  private static server(path: string, chosen: string | null, source: ExecutableSource): AntigravityServer | null {
    return Object.isNull(chosen) ? new AntigravityServer(new ProcessCommand(path, []), `${path}.harness`, source) : null;
  }
}
