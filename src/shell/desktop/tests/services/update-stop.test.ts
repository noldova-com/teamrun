/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, Response, UpdateProcess, UpdateReady } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, type IProcessStarter, Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";
import { AppImageRestart, type IUpdateTarget, UpdateHandoffException, UpdateStop, UpdateStopException } from "@noldova/teamrun-shell-desktop";

import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { LinuxLaunchFixture } from "../fixtures/linux-launch.fixture.js";

@TestClass
export class UpdateStopTests {
  private static readonly SELF: number = 4120;
  private static readonly REFUSED: Failure = new Failure(FailureCode.Updating, "TeamRun is preparing to install an update.");

  private readonly presence: FakeProcessPresence = new FakeProcessPresence();
  private readonly connections: Map<string, FakeRuntimeConnection> = new Map();
  private readonly asked: (readonly string[])[] = [];
  private readonly waits: number[] = [];
  private readonly lines: string[] = [];
  private answer: boolean = true;
  private rereads: boolean = false;
  private isWaitedOut: boolean = false;
  private onAsk?: () => void;
  private time: number = 0;
  private onConnect?: (dataDirectory: string) => Promise<void>;

  @TestMethod
  public handsOffOnceEveryRuntimeAndProcessHasExitedAndTheOtherDesktopsHaveQuit(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      const program = new UpdateProcess(7001, 1500, 1501, "program");
      const other = new UpdateProcess(4130, 1500, 1501, "desktop");
      const self = new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "desktop");
      const unconnected = new UpdateProcess(4140, 1500, 1501, "desktop");
      this.ready(first, [program, other, self]);
      this.ready(second, []);
      this.presence.running.add(7001).add(4130).add(4140).add(UpdateStopTests.SELF);
      await installation.recordDesktopAsync(self);
      await installation.recordDesktopAsync(other);
      await installation.recordDesktopAsync(unconnected);
      const states: string[] = [];
      this.presence.onCheck = t => {
        if (t.processId === 7001 && this.waits.length === 1)
          this.presence.running.delete(7001);
        if ((t.processId === 4130 || t.processId === 4140) && this.waits.length > 1) {
          states.push(`${t.processId} ${JSON.parse(String(this.readBarrier(installation))).state as string}`);
          this.presence.running.delete(t.processId);
        }
      };
      let handedOff = "";

      const isHandedOff = await this.create(installation).runAsync("0.3.0", async () => {
        handedOff = await readFile(installation.barrierFile, "utf8");
        return null;
      });

      Assert.isTrue(isHandedOff);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), handedOff);
      Assert.areEqual("4130 Closing|4140 Closing", states.join("|"));
      Assert.areEqual("shell.work|shell.update|shell.work|shell.stop", this.connections.get(first)?.calls.join("|"));
      Assert.areEqual("shell.work|shell.update|shell.work|shell.stop", this.connections.get(second)?.calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "IfIdle" }), JSON.stringify(this.connections.get(first)?.payloads[3]));
      Assert.isTrue([...this.connections.values()].every(t => t.isClosed));
      Assert.areEqual("250|250", this.waits.join("|"));
      Assert.areEqual(1, this.presence.checked.filter(t => t === UpdateStopTests.SELF).length);
      Assert.areEqual(0, this.asked.length);
    });
  }

  @TestMethod
  public cancelsWithNothingChangedWhenThePersonKeepsTheWork(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.answer = false;
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      let isHandedOff = false;

      const result = await this.create(installation).runAsync("0.3.0", async () => {
        isHandedOff = true;
        return null;
      });

      Assert.isFalse(result);
      Assert.isFalse(isHandedOff);
      Assert.areEqual(JSON.stringify([[`A reply (${first})`]]), JSON.stringify(this.asked));
      Assert.areEqual("shell.work", this.connection(first).calls.join("|"));
      Assert.isTrue(this.connection(first).isClosed);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public stopsOnlyTheWorkThePersonAgreedToAndSkipsADirectoryNotInUse(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const unused = await this.recordAsync(installation, folder, "unused");
      const idle = await this.recordAsync(installation, folder, "idle");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.ready(first, []);
      this.rereads = true;

      const result = await this.create(installation, t => t === unused).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result);
      Assert.areEqual(JSON.stringify([[`A reply (${first})`], [`A reply (${first})`]]), JSON.stringify(this.asked));
      Assert.areEqual("shell.work|shell.work|shell.update|shell.work|shell.stop", this.connection(first).calls.join("|"));
      Assert.isFalse(this.connections.has(unused));
      Assert.areEqual(JSON.stringify({ policy: "StopWork" }), JSON.stringify(this.connection(first).payloads[4]));
      Assert.areEqual("shell.work|shell.work|shell.update|shell.work|shell.stop", this.connection(idle).calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "IfIdle" }), JSON.stringify(this.connection(idle).payloads[4]));
    });
  }

  @TestMethod
  public dropsTheWorkOfARuntimeThatLeavesWhileThePersonWaits(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.connection(second).answers.set("shell.work", Response.success("r", { descriptions: ["A command"], sequence: 1 }));
      this.rereads = true;
      this.onAsk = () => {
        this.connection(second).rejection = new ConnectionException("The connection closed.");
      };

      const result = await this.create(installation, t => t === second && this.asked.length > 0).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result);
      Assert.areEqual(JSON.stringify([`A command (${second})`, `A reply (${first})`]), JSON.stringify([...this.asked[0] ?? []].sort()));
      Assert.areEqual(JSON.stringify([`A reply (${first})`]), JSON.stringify(this.asked[1]));
      Assert.isTrue(this.connection(second).isClosed);
      Assert.areEqual("shell.work|shell.work", this.connection(second).calls.join("|"));
      Assert.areEqual("shell.work|shell.work|shell.update|shell.work|shell.stop", this.connection(first).calls.join("|"));
    });
  }

  @TestMethod
  public stopsTheWorkShownWhenThePersonChoseStopIncludingWorkThatStartedWhileTheyWaited(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.rereads = true;
      this.onAsk = () => {
        this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply", "A command"], sequence: 2 }));
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(null));

      Assert.isTrue(result);
      Assert.areEqual(JSON.stringify([`A reply (${first})`, `A command (${first})`]), JSON.stringify(this.asked[1]));
      Assert.areEqual("shell.work|shell.work|shell.update|shell.work|shell.stop", this.connection(first).calls.join("|"));
      Assert.areEqual(JSON.stringify({ policy: "StopWork" }), JSON.stringify(this.connection(first).payloads[4]));
    });
  }

  @TestMethod
  public failsWhenWorkStartsAgainAfterThePersonWaitedForItToFinish(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.isWaitedOut = true;

      const failure = await this.failAsync(installation);

      Assert.areEqual(`Work started while TeamRun prepared to update: A reply (${first})`, failure.message);
      Assert.areEqual("shell.work|shell.update|shell.work", this.connection(first).calls.join("|"));
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public keepsItsReasonAndLogsABarrierItCannotRemove(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.isWaitedOut = true;
      using _rm = new FailingFileCallFixture("rm", installation.barrierFile, "EBUSY");

      const failure = await this.failAsync(installation);

      Assert.areEqual(`Work started while TeamRun prepared to update: A reply (${first})`, failure.message);
      Assert.areEqual(JSON.stringify([`The update's barrier could not be removed after the update stopped: Error: EBUSY: operation failed, rm '${installation.barrierFile}'`]),
        JSON.stringify(this.lines));
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public closesTheConnectionsItOpenedWhenAnotherDataDirectoryCannotBeReached(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const second = await this.recordAsync(installation, folder, "second");
      const unreachable = new UpdateStopException(`TeamRun couldn't reach the runtime of ${second} to stop it for the update.`);
      this.onConnect = t => t === second ? Promise.reject(unreachable) : Promise.resolve();

      const failure = await this.failAsync(installation);

      Assert.areEqual(unreachable, failure);
      Assert.isTrue(this.connection(first).isClosed);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWhenTheWorkCannotBeReadAgainForAnotherReason(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.rereads = true;
      const invalid = new Error("The frame was not valid.");
      this.onAsk = () => {
        this.connection(first).rejection = invalid;
      };

      const failure = await this.failAsync(installation);

      Assert.areEqual("The update stopped on an unexpected error.", failure.message);
      Assert.areEqual(invalid, failure.cause);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWithNothingChangedWhenAnotherUpdateHoldsTheBarrier(): Promise<void> {
    return this.runAsync(async installation => {
      const other = new UpdateBarrier(new UpdateProcess(4130, 1500, 1501, "desktop"), "0.4.0", UpdateBarrierState.Preparing, null);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(other.toJson()));
      this.presence.running.add(4130);

      const failure = await this.failAsync(installation);

      Assert.areEqual("Another update of TeamRun is under way.", failure.message);
      Assert.areEqual(JSON.stringify(other.toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public failsWithNothingChangedWhenItCannotFindItsOwnProcessOrARuntimeWillNotSayItsWork(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.presence.isStamping = false;
      const unstamped = await this.failAsync(installation);
      this.presence.isStamping = true;
      this.connections.clear();
      this.connection(first).answers.set("shell.work", Response.failure("r", UpdateStopTests.REFUSED));
      const unread = await this.failAsync(installation);

      Assert.areEqual("TeamRun could not find its own process in the process table.", unstamped.message);
      Assert.areEqual(`The runtime of ${first} could not prepare for the update: TeamRun is preparing to install an update.`, unread.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenWorkStartsMeanwhile(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const late = join(folder, "late");
      await mkdir(late);
      this.connection(late).answers.set("shell.work", Response.success("r", { descriptions: ["A command"], sequence: 1 }));
      this.onConnect = async t => {
        if (t === first)
          await installation.recordAsync(late);
      };

      const failure = await this.failAsync(installation);

      Assert.areEqual(`Work started while TeamRun prepared to update: A command (${late})`, failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
      Assert.isTrue(this.connection(first).isClosed && this.connection(late).isClosed);
      Assert.areEqual("shell.work|shell.update|shell.work", this.connection(first).calls.join("|"));
      Assert.areEqual("shell.update|shell.work", this.connection(late).calls.join("|"));
    });
  }

  @TestMethod
  public failsWhenWorkThePersonDidNotSeeStartedWhileTheyDecided(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const reads = [["A reply"], ["A reply", "A command"]];
      this.connection(first).deferred.set("shell.work", () => Promise.resolve(Response.success("r", { descriptions: reads.shift() ?? [], sequence: 1 })));

      const failure = await this.failAsync(installation);

      Assert.areEqual(`Work started while TeamRun prepared to update: A command (${first})`, failure.message);
      Assert.areEqual(1, this.asked.length);
      Assert.areEqual("shell.work|shell.update|shell.work", this.connection(first).calls.join("|"));
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenARecordedDesktopDoesNotQuitInTime(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      await installation.recordDesktopAsync(new UpdateProcess(4140, 1500, 1501, "desktop"));
      this.presence.running.add(4140);

      const failure = await this.failAsync(installation);

      Assert.areEqual("These processes did not exit within 10 seconds: desktop 4140", failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenARuntimeRefusesOrSomethingDidNotSave(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.connection(first).answers.set("shell.update", Response.failure("r", UpdateStopTests.REFUSED));
      const refused = await this.failAsync(installation);
      this.connections.clear();
      this.connection(first).answers.set("shell.update", Response.success("r", new UpdateReady(["Notes couldn't save", "A cli client did not answer in time."], []).toJson()));
      const unsaved = await this.failAsync(installation);
      this.connections.clear();
      this.ready(first, []);
      this.connection(first).answers.set("shell.stop", Response.failure("r", UpdateStopTests.REFUSED));
      const unstopped = await this.failAsync(installation);

      Assert.areEqual(`The runtime of ${first} could not prepare for the update: TeamRun is preparing to install an update.`, refused.message);
      Assert.areEqual(`Not everything of ${first} was saved: Notes couldn't save; A cli client did not answer in time.`, unsaved.message);
      Assert.areEqual(`The runtime of ${first} could not prepare for the update: TeamRun is preparing to install an update.`, unstopped.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsAndLetsEverythingResumeWhenAProcessDoesNotExitInTimeOrCannotBeChecked(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      this.ready(first, [new UpdateProcess(7001, 1500, 1501, "program")]);
      this.presence.running.add(7001);
      const late = await this.failAsync(installation);
      const waited = this.waits.length;
      this.connections.clear();
      this.ready(first, []);
      const unreadable = new Error("ps exited with code 1.");
      this.presence.failure = unreadable;
      const unchecked = await this.failAsync(installation);

      Assert.areEqual("These processes did not exit within 10 seconds: program 7001", late.message);
      Assert.areEqual(40, waited);
      Assert.areEqual("The update stopped on an unexpected error.", unchecked.message);
      Assert.areEqual(unreadable, unchecked.cause);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public recordsTheProcessThatTookTheHandoffSoTheBarrierHoldsWhileItRuns(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(
        new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.HandedOff, new UpdateProcess(5200, 1500, 1501, "handoff")).toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public keepsTheBarrierWithoutItsHandoffWhenThatProcessCannotBeFound(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.onStamp = t => {
        if (t[0]?.[1] === "handoff")
          throw new Error("The process table could not be read.");
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), this.readBarrier(installation));
    });
  }

  @TestMethod
  public stillReportsTheHandoffWhenItsProcessCannotBeRecorded(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");
      this.presence.onStamp = t => {
        if (t[0]?.[1] === "handoff")
          rmSync(installation.folder, { recursive: true, force: true });
      };

      const result = await this.create(installation).runAsync("0.3.0", () => Promise.resolve(5200));

      Assert.isTrue(result);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public startsTheAppImageRestartOnceHandedOffAndBeforeTheHandoff(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      const steps: string[] = [];
      const restart = UpdateStopTests.createRestart(async () => {
        steps.push(`restart ${String(JSON.parse(await readFile(installation.barrierFile, "utf8")).state)}`);
        return 0x3fffffff;
      });

      const isHandedOff = await this.create(installation, undefined, restart).runAsync("0.3.0", () => {
        steps.push("handoff");
        return Promise.resolve(null);
      });

      Assert.isTrue(isHandedOff);
      Assert.areEqual("restart HandedOff|handoff", steps.join("|"));
    });
  }

  @TestMethod
  public endsTheAppImageRestartWhenTheHandoffFails(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      const waiting = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
      await once(waiting, "spawn");
      const exited = once(waiting, "exit");

      const refusal = new UpdateHandoffException("The update isn't signed by the publisher.");

      const failure = await Assert.throwsAsync(() => this.create(installation, undefined, UpdateStopTests.createRestart(() => Promise.resolve(Number(waiting.pid))))
        .runAsync("0.3.0", () => Promise.reject(refusal)), UpdateHandoffException);
      await exited;

      Assert.areEqual(refusal, failure);
      Assert.isNotNull(waiting.exitCode ?? waiting.signalCode);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public failsWithoutHandingOffWhenTheAppImageRestartCannotStart(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      using _launch = new LinuxLaunchFixture();
      await this.recordAsync(installation, folder, "first");
      let isCalled = false;
      const missing = new Error("Bash is missing.");

      const failure = await Assert.throwsAsync(() => this.create(installation, undefined, UpdateStopTests.createRestart(() => Promise.reject(missing)))
        .runAsync("0.3.0", () => {
          isCalled = true;
          return Promise.resolve(null);
        }), UpdateStopException);

      Assert.areEqual("The update stopped on an unexpected error.", failure.message);
      Assert.areEqual(missing, failure.cause);
      Assert.isFalse(isCalled);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public removesTheBarrierWhenTheHandoffFails(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");

      const failure = await Assert.throwsAsync(() => this.create(installation)
        .runAsync("0.3.0", () => Promise.reject(new UpdateHandoffException("The installer is missing."))), UpdateHandoffException);

      Assert.areEqual("The installer is missing.", failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  private static createRestart(startAsync: () => Promise<number>): AppImageRestart | null {
    const starter: IProcessStarter = { startAsync };
    return AppImageRestart.find("linux", { APPIMAGE: "/home/person/TeamRun.AppImage", APPDIR: "/tmp/.mount_TeamRuX" }, "/tmp/.mount_TeamRuX/teamrun", [], starter, UpdateStopTests.SELF,
      "/tmp/restart.log");
  }

  private create(installation: Installation, isUnused: (dataDirectory: string) => boolean = () => false, restart: AppImageRestart | null = null): UpdateStop {
    return new UpdateStop(
      installation,
      this.presence,
      async t => {
        await this.onConnect?.(t);
        return isUnused(t) ? null : this.target(t);
      },
      async (t, read) => {
        this.asked.push(t);
        this.onAsk?.();
        const shown = this.rereads ? await read() : t;
        if (this.rereads)
          this.asked.push(shown);
        if (!this.answer)
          return null;
        return this.isWaitedOut ? [] : shown;
      },
      UpdateStopTests.SELF,
      "0.2.0",
      () => this.time,
      t => {
        this.waits.push(t);
        this.time += t;
        return Promise.resolve();
      },
      restart,
      t => this.lines.push(t));
  }

  private target(dataDirectory: string): IUpdateTarget {
    return { dataDirectory, runtime: new UpdateProcess(9000, 1500, 1501, "runtime"), connection: this.connection(dataDirectory) };
  }

  private connection(dataDirectory: string): FakeRuntimeConnection {
    const existing = this.connections.get(dataDirectory);
    if (!Object.isUndefined(existing))
      return existing;
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.update", Response.success("r", new UpdateReady([], []).toJson()));
    this.connections.set(dataDirectory, connection);
    return connection;
  }

  private ready(dataDirectory: string, processes: readonly UpdateProcess[]): void {
    this.connection(dataDirectory).answers.set("shell.update", Response.success("r", new UpdateReady([], processes).toJson()));
  }

  private readBarrier(installation: Installation): string | null {
    return existsSync(installation.barrierFile) ? readFileSync(installation.barrierFile, "utf8") : null;
  }

  private async recordAsync(installation: Installation, folder: string, name: string): Promise<string> {
    const root = join(folder, name);
    await mkdir(root);
    await installation.recordAsync(root);
    return root;
  }

  private async failAsync(installation: Installation): Promise<UpdateStopException> {
    return await Assert.throwsAsync(() => this.create(installation).runAsync("0.3.0", () => Promise.resolve(null)), UpdateStopException) as UpdateStopException;
  }

  private async runAsync(test: (installation: Installation, folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-update-stop-"));
    try {
      await test(new Installation(join(folder, "installation"), t => this.presence.isRunningAsync(t)), folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
