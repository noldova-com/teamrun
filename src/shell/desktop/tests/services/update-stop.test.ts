/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, Response, UpdateProcess, UpdateReady } from "@noldova/teamrun-shell-protocol";
import { Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";
import { type IUpdateTarget, UpdateStop, UpdateStopException } from "@noldova/teamrun-shell-desktop";

import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";

@TestClass
export class UpdateStopTests {
  private static readonly SELF: number = 4120;
  private static readonly REFUSED: Failure = new Failure(FailureCode.Updating, "TeamRun is preparing to install an update.");

  private readonly presence: FakeProcessPresence = new FakeProcessPresence();
  private readonly connections: Map<string, FakeRuntimeConnection> = new Map();
  private readonly asked: (readonly string[])[] = [];
  private readonly waits: number[] = [];
  private answer: boolean = true;
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
      this.ready(first, [program, other, self]);
      this.ready(second, []);
      this.presence.running.add(7001).add(4130).add(UpdateStopTests.SELF);
      const states: string[] = [];
      this.presence.onCheck = t => {
        if (t.processId === 7001 && this.waits.length === 1)
          this.presence.running.delete(7001);
        if (t.processId === 4130) {
          states.push(JSON.parse(String(this.readBarrier(installation))).state as string);
          this.presence.running.delete(4130);
        }
      };
      let handedOff = "";

      const isHandedOff = await this.create(installation).runAsync("0.3.0", async () => {
        handedOff = await readFile(installation.barrierFile, "utf8");
      });

      Assert.isTrue(isHandedOff);
      Assert.areEqual(JSON.stringify(new UpdateBarrier(new UpdateProcess(UpdateStopTests.SELF, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.HandedOff, null).toJson()), handedOff);
      Assert.areEqual("Closing", states.join("|"));
      Assert.areEqual("shell.work|shell.update|shell.stop", this.connections.get(first)?.calls.join("|"));
      Assert.areEqual("shell.work|shell.update|shell.stop", this.connections.get(second)?.calls.join("|"));
      Assert.isTrue([...this.connections.values()].every(t => t.isClosed));
      Assert.areEqual("250", this.waits.join("|"));
      Assert.isFalse(this.presence.checked.includes(UpdateStopTests.SELF));
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
  public goesOnPastTheWorkWhenThePersonStopsItAndSkipsADirectoryNotInUse(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      const first = await this.recordAsync(installation, folder, "first");
      const unused = await this.recordAsync(installation, folder, "unused");
      this.connection(first).answers.set("shell.work", Response.success("r", { descriptions: ["A reply"], sequence: 1 }));
      this.ready(first, []);

      const result = await this.create(installation, t => t === unused).runAsync("0.3.0", () => Promise.resolve());

      Assert.isTrue(result);
      Assert.areEqual(1, this.asked.length);
      Assert.isFalse(this.connections.has(unused));
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
      Assert.areEqual("shell.work", this.connection(first).calls.join("|"));
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
      Assert.areEqual("ps exited with code 1.", unchecked.message);
      Assert.areEqual(unreadable, unchecked.cause);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public removesTheBarrierWhenTheHandoffFails(): Promise<void> {
    return this.runAsync(async (installation, folder) => {
      await this.recordAsync(installation, folder, "first");

      const failure = await Assert.throwsAsync(() => this.create(installation).runAsync("0.3.0", () => Promise.reject("The installer is missing.")), UpdateStopException);

      Assert.areEqual("The installer is missing.", failure.message);
      Assert.isFalse(existsSync(installation.barrierFile));
    });
  }

  private create(installation: Installation, isUnused: (dataDirectory: string) => boolean = () => false): UpdateStop {
    return new UpdateStop(
      installation,
      this.presence,
      async t => {
        await this.onConnect?.(t);
        return isUnused(t) ? null : this.target(t);
      },
      t => {
        this.asked.push(t);
        return Promise.resolve(this.answer);
      },
      UpdateStopTests.SELF,
      "0.2.0",
      () => this.time,
      t => {
        this.waits.push(t);
        this.time += t;
        return Promise.resolve();
      });
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
    return await Assert.throwsAsync(() => this.create(installation).runAsync("0.3.0", () => Promise.resolve()), UpdateStopException) as UpdateStopException;
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
