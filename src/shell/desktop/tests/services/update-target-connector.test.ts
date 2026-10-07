/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rmSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event, ShellEvents, UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, LaunchException, NoRuntimeException, OwnershipLock, RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
import { UpdateStopException, UpdateTargetConnector } from "@noldova/teamrun-shell-desktop";

import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class UpdateTargetConnectorTests {
  private static readonly INSTALLATION: string = "/home/person/.config/TeamRun/installations/0123456789abcdef";
  private static readonly PROGRAM: string = "/home/person/Applications/TeamRun.AppImage";

  private readonly presence: FakeProcessPresence = new FakeProcessPresence();
  private readonly launched: string[] = [];
  private readonly waits: number[] = [];
  private launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher();
  private time: number = 0;
  private onWait: () => Promise<void> = () => Promise.resolve();

  @TestMethod
  public skipsADirectoryThatNoRuntimeOwns(): Promise<void> {
    return this.runAsync(async root => {
      const target = await this.create().connectAsync(root);

      Assert.isNull(target);
      Assert.areEqual(0, this.launched.length);
    });
  }

  @TestMethod
  public skipsADirectoryWhoseRuntimeRunsFromAnotherProgram(): Promise<void> {
    return this.runAsync(async root => {
      await UpdateTargetConnectorTests.publishAsync(root, "/opt/Other.AppImage");

      const target = await this.create().connectAsync(root);

      Assert.isNull(target);
      Assert.areEqual(0, this.launched.length);
    });
  }

  @TestMethod
  public connectsAsTheUpdateClientWithoutStartingOrTakingOverARuntime(): Promise<void> {
    return this.runAsync(async root => {
      await UpdateTargetConnectorTests.publishAsync(root, UpdateTargetConnectorTests.PROGRAM);
      const connection = new FakeRuntimeConnection();
      this.launcher = new FakeRuntimeLauncher(connection);

      const target = await this.create().connectAsync(root);

      Assert.isNotNull(target);
      Assert.areEqual(root, target.dataDirectory);
      Assert.areEqual(connection, target.connection);
      Assert.areEqual(JSON.stringify(new UpdateProcess(4242, 1500, 1501, "runtime").toJson()), JSON.stringify(target.runtime.toJson()));
      Assert.areEqual(JSON.stringify([root]), JSON.stringify(this.launched));
      Assert.areEqual(JSON.stringify(["attach update IfIdle"]), JSON.stringify(this.launcher.calls));
      Assert.areEqual(false, this.launcher.options[0]?.start);
      Assert.areEqual(false, this.launcher.options[0]?.takeOver);
      this.launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: [], sequence: 1 }));
      this.launcher.listener?.onDisconnected(null);
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public waitsForTheRuntimeOfAnOwnedDirectoryToPublishItselfAndConnects(): Promise<void> {
    return this.runAsync(async root => {
      using _lock = OwnershipLock.acquire(new DataDirectory(root));
      const connection = new FakeRuntimeConnection();
      this.launcher = new FakeRuntimeLauncher(connection);
      this.onWait = () => UpdateTargetConnectorTests.publishAsync(root, UpdateTargetConnectorTests.PROGRAM);

      const target = await this.create().connectAsync(root);

      Assert.areEqual(connection, target?.connection);
      Assert.areEqual(JSON.stringify([250]), JSON.stringify(this.waits));
    });
  }

  @TestMethod
  public skipsAnOwnedDirectoryWhoseRuntimeEndsBeforeItPublishesItself(): Promise<void> {
    return this.runAsync(async root => {
      const lock = OwnershipLock.acquire(new DataDirectory(root));
      this.onWait = () => {
        lock[Symbol.dispose]();
        return Promise.resolve();
      };

      const target = await this.create().connectAsync(root);

      Assert.isNull(target);
      Assert.areEqual(JSON.stringify([250]), JSON.stringify(this.waits));
      Assert.areEqual(0, this.launched.length);
    });
  }

  @TestMethod
  public failsWhenTheRuntimeOfAnOwnedDirectoryIsStillStartingAfterFifteenSeconds(): Promise<void> {
    return this.runAsync(async root => {
      using _lock = OwnershipLock.acquire(new DataDirectory(root));

      const failure = await Assert.throwsAsync(() => this.create().connectAsync(root), UpdateStopException);

      Assert.areEqual(`The runtime of ${root} was still starting, so it couldn't be stopped for the update.`, failure.message);
      Assert.areEqual(15_000, this.waits.reduce((total, t) => total + t, 0));
      Assert.areEqual(0, this.launched.length);
    });
  }

  @TestMethod
  public skipsARuntimeThatStoppedBeforeItConnected(): Promise<void> {
    return this.runAsync(async root => {
      await UpdateTargetConnectorTests.publishAsync(root, UpdateTargetConnectorTests.PROGRAM);
      this.launcher = new FakeRuntimeLauncher(new NoRuntimeException(root));

      const target = await this.create().connectAsync(root);

      Assert.isNull(target);
    });
  }

  @TestMethod
  public explainsARuntimeItCannotReach(): Promise<void> {
    return this.runAsync(async root => {
      await UpdateTargetConnectorTests.publishAsync(root, UpdateTargetConnectorTests.PROGRAM);
      const cause = new LaunchException("TeamRun's runtime didn't start in time.");
      this.launcher = new FakeRuntimeLauncher(cause);

      const failure = await Assert.throwsAsync(() => this.create().connectAsync(root), UpdateStopException);

      Assert.areEqual(`TeamRun couldn't reach the runtime of ${root} to stop it for the update.`, failure.message);
      Assert.areEqual(cause, failure.cause);
    });
  }

  @TestMethod
  public explainsADiscoveryItCannotRead(): Promise<void> {
    return this.runAsync(async root => {
      const discovery = new DataDirectory(root).discoveryFile;
      await mkdir(join(discovery, ".."), { recursive: true });
      await writeFile(discovery, "{");

      const failure = await Assert.throwsAsync(() => this.create().connectAsync(root), UpdateStopException);

      Assert.areEqual(`TeamRun couldn't reach the runtime of ${root} to stop it for the update.`, failure.message);
      Assert.areEqual(0, this.launched.length);
    });
  }

  @TestMethod
  public closesTheConnectionWhenTheRuntimeCannotBeIdentified(): Promise<void> {
    return this.runAsync(async root => {
      await UpdateTargetConnectorTests.publishAsync(root, UpdateTargetConnectorTests.PROGRAM);
      const unstamped = new FakeRuntimeConnection();
      const unpublished = new FakeRuntimeConnection();
      this.launcher = new FakeRuntimeLauncher(unstamped, unpublished);
      this.presence.isStamping = false;

      const first = await Assert.throwsAsync(() => this.create().connectAsync(root), UpdateStopException);
      this.presence.isStamping = true;
      this.launcher.onAttach = () => rmSync(new DataDirectory(root).discoveryFile);
      const second = await Assert.throwsAsync(() => this.create().connectAsync(root), UpdateStopException);

      const reason = `The runtime of ${root} could not be identified, so it can't be verified to stop for the update.`;
      Assert.areEqual(reason, first.message);
      Assert.areEqual(reason, second.message);
      Assert.isTrue(unstamped.isClosed);
      Assert.isTrue(unpublished.isClosed);
    });
  }

  private create(): UpdateTargetConnector {
    return new UpdateTargetConnector(UpdateTargetConnectorTests.INSTALLATION,
      t => t === UpdateTargetConnectorTests.PROGRAM ? UpdateTargetConnectorTests.INSTALLATION : "/home/person/.config/TeamRun/installations/fedcba9876543210", t => {
        this.launched.push(t.root);
        return this.launcher;
      }, this.presence, () => this.time, async t => {
        this.waits.push(t);
        this.time += t;
        await this.onWait();
      });
  }

  private static async publishAsync(root: string, program: string): Promise<void> {
    const file = new DataDirectory(root).discoveryFile;
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, JSON.stringify(new RuntimeDiscovery("127.0.0.1:52000", "capability-token", 4242, program, "0.0.1", 1, "build-fingerprint").toJson()));
  }

  private async runAsync(action: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "tr-update-target-"));
    try {
      await action(root);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
