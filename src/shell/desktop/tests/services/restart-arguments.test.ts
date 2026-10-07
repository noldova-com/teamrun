/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceFolder, Installation, ProductInfo, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

class Restarted {
  public readonly folder: string;
  public readonly data: string;
  public readonly profile: string;
  public readonly device: string;
  public readonly isPackaged: boolean;
  public readonly process: FakeDesktopProcess;
  public readonly electron: FakeElectron;
  public readonly installations: Installation[] = [];

  public constructor(folder: string, platform: string, argv: readonly string[], isPackaged: boolean) {
    this.folder = folder;
    this.data = join(folder, "data");
    this.profile = join(folder, "profile");
    this.device = join(folder, "device");
    this.isPackaged = isPackaged;
    this.process = new FakeDesktopProcess(platform, ["/electron/electron", "--updated", ...argv], { LOCALAPPDATA: join(folder, "local") }, join(folder, "home"));
    this.process.temporaryFolder = join(folder, "temporary");
    this.process.accountHomeFolder = join(folder, "account");
    this.electron = new FakeElectron(true, isPackaged);
  }

  public get file(): string {
    return this.isPackaged ? this.fileIn(DeviceFolder.locate(this.process.platform, {}, this.process.accountHomeFolder)) : this.temporaryFile;
  }

  public get temporaryFile(): string {
    return this.fileIn(this.process.temporaryFolder);
  }

  public get kept(): readonly string[] {
    return [`--data-dir=${this.data}`, `--user-data-dir=${this.profile}`, `--device-dir=${this.device}`];
  }

  public get taken(): string[] {
    return DesktopStartFixture.readErrors(this.process, "The desktop runs on the folders of the version it updated: ");
  }

  public async writeAsync(value: unknown, file: string = this.file): Promise<void> {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Object.isString(value) ? value : JSON.stringify(value));
  }

  public start(): string | undefined {
    const [settings] = DesktopStartFixture.start(this.electron, this.process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(),
      this.installations);
    return settings?.dataDirectory.root;
  }

  private fileIn(folder: string): string {
    return join(folder, `${ProductInfo.current.slug}-restart-${basename(Installation.locate(folder, this.process.execPath, this.process.platform))}.json`);
  }
}

@TestClass
export class RestartArgumentsTests {
  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async startsOnTheFoldersTheVersionItUpdatedKeptForIt(platform: string): Promise<void> {
    await RestartArgumentsTests.withRestartAsync(platform, [], true, async restarted => {
      await restarted.writeAsync({ version: RuntimeBuild.identity.productVersion, arguments: restarted.kept, written: Date.now() });

      const root = restarted.start();

      Assert.areEqual(restarted.data, root);
      Assert.areEqual(JSON.stringify([`setPath userData ${restarted.profile}`]), JSON.stringify(restarted.electron.app.calls.filter(t => t.startsWith("setPath"))));
      Assert.areEqual(Installation.locate(restarted.device, restarted.process.execPath, platform), restarted.installations[0]?.folder);
      Assert.areEqual(1, restarted.taken.length);
      Assert.isTrue(/^The desktop runs on the folders of the version it updated: --data-dir=\S+[\\/]data --user-data-dir=\S+[\\/]profile --device-dir=\S+[\\/]device$/.test(restarted.taken[0] ?? ""),
        restarted.taken.join("\n"));
      Assert.isFalse(existsSync(restarted.file));
    });
  }

  @TestMethod
  public async keepsItsProfileInTheKeptDataFolderWhenNoProfileWasKept(): Promise<void> {
    await RestartArgumentsTests.withRestartAsync("win32", [], true, async restarted => {
      await restarted.writeAsync({ version: RuntimeBuild.identity.productVersion, arguments: [`--data-dir=${restarted.data}`], written: Date.now() });

      const root = restarted.start();

      Assert.areEqual(restarted.data, root);
      Assert.areEqual(JSON.stringify([`setPath userData ${join(restarted.data, "desktop")}`]), JSON.stringify(restarted.electron.app.calls.filter(t => t.startsWith("setPath"))));
    });
  }

  @TestMethod
  @TestData("another version")
  @TestData("too old")
  @TestData("written later")
  @TestData("another argument")
  @TestData("no version")
  @TestData("unreadable")
  public async startsOnItsOwnFoldersAndForgetsWhatWasKeptWhenItIsNotForThisStart(kind: string): Promise<void> {
    await RestartArgumentsTests.withRestartAsync("darwin", [], true, async restarted => {
      const now = Date.now();
      const version = RuntimeBuild.identity.productVersion;
      const values = new Map<string, unknown>([
        ["another version", { version: `${version}.1`, arguments: restarted.kept, written: now }],
        ["too old", { version, arguments: restarted.kept, written: now - 600001 }],
        ["written later", { version, arguments: restarted.kept, written: now + 60000 }],
        ["another argument", { version, arguments: [...restarted.kept, "--inspect=9229"], written: now }],
        ["no version", { arguments: restarted.kept, written: now }],
        ["unreadable", "{"]
      ]);
      await restarted.writeAsync(values.get(kind));

      const root = restarted.start();

      Assert.areNotEqual(restarted.data, root);
      Assert.areEqual(0, restarted.taken.length);
      Assert.isFalse(existsSync(restarted.file));
    });
  }

  @TestMethod
  public async keepsTheFoldersItIsGivenAndForgetsWhatWasKept(): Promise<void> {
    await RestartArgumentsTests.withRestartAsync("darwin", ["--data-dir=given"], true, async restarted => {
      await restarted.writeAsync({ version: RuntimeBuild.identity.productVersion, arguments: restarted.kept, written: Date.now() });

      const root = restarted.start();

      Assert.areEqual(join(restarted.process.workingDirectory, "given"), root);
      Assert.areEqual(0, restarted.taken.length);
      Assert.isFalse(existsSync(restarted.file));
    });
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async leavesFoldersKeptInItsTemporaryFolderAloneSinceTheNewVersionGetsTheAccountsOwn(platform: string): Promise<void> {
    await RestartArgumentsTests.withRestartAsync(platform, [], true, async restarted => {
      await restarted.writeAsync({ version: RuntimeBuild.identity.productVersion, arguments: restarted.kept, written: Date.now() }, restarted.temporaryFile);

      const root = restarted.start();

      Assert.areNotEqual(restarted.data, root);
      Assert.areEqual(0, restarted.taken.length);
      Assert.isTrue(existsSync(restarted.temporaryFile));
    });
  }

  @TestMethod
  public async readsTheSameAccountHomeFolderWhateverTheEnvironmentNamesAsHomeOrTemporaryFolder(): Promise<void> {
    await RestartArgumentsTests.withRestartAsync(process.platform, [], true, async restarted => {
      const elsewhere = Object.fromEntries(["HOME", "USERPROFILE", "LOCALAPPDATA", "TMPDIR", "TEMP", "TMP"].map(t => [t, restarted.folder]));

      const { stdout } = await promisify(execFile)(process.execPath, ["-e", "process.stdout.write(require(\"node:os\").userInfo().homedir)"], { env: { ...process.env, ...elsewhere } });

      Assert.areEqual(userInfo().homedir, stdout);
      Assert.areNotEqual(restarted.folder, stdout);
    });
  }

  @TestMethod
  public async leavesWhatWasKeptAloneInADevelopmentStart(): Promise<void> {
    await RestartArgumentsTests.withRestartAsync("darwin", [], false, async restarted => {
      await restarted.writeAsync({ version: RuntimeBuild.identity.productVersion, arguments: restarted.kept, written: Date.now() });

      const root = restarted.start();

      Assert.areNotEqual(restarted.data, root);
      Assert.isTrue(existsSync(restarted.file));
    });
  }

  private static async withRestartAsync(platform: string, argv: readonly string[], isPackaged: boolean, run: (restarted: Restarted) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-restart-arguments-"));
    try {
      await run(new Restarted(folder, platform, argv, isPackaged));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
