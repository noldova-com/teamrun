/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TrayHostWatcher } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { CountingProgramHost } from "../fixtures/counting-program-host.fixture.js";
import { FakeClock } from "../fixtures/fake-clock.fixture.js";
import { FakeProgramHost } from "../fixtures/fake-program-host.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { PrivateSessionBus } from "../fixtures/private-session-bus.fixture.js";
import { StatusNotifierWatcherFixture } from "../fixtures/status-notifier-watcher.fixture.js";

const GDBUS = "/usr/bin/gdbus";
const REGISTERED = "(<true>,)\n";
const UNREGISTERED = "(<false>,)\n";

class WatcherFixture {
  public readonly programs: FakeProgramHost = new FakeProgramHost();
  public readonly clock: FakeClock = new FakeClock();
  public readonly changes: boolean[] = [];
  public readonly environment: NodeJS.ProcessEnv = { DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus" };
  public readonly watcher: TrayHostWatcher;

  public constructor(platform: string) {
    this.watcher = new TrayHostWatcher(platform, this.programs, this.environment, t => this.clock.waitAsync(t, new AbortController().signal), t => this.changes.push(t));
  }
}

@TestClass
export class TrayHostWatcherTests {
  @TestMethod
  public findsAHostOnWindowsAndMacOSWithoutRunningAnything(): void {
    for (const platform of ["win32", "darwin"]) {
      const fixture = new WatcherFixture(platform);

      fixture.watcher.start();
      fixture.watcher.stop();

      Assert.isTrue(fixture.watcher.isAvailable);
      Assert.areEqual(0, fixture.programs.runs.length + fixture.programs.starts.length + fixture.changes.length);
    }
  }

  @TestMethod
  public async asksTheSessionBusOnLinuxAndReportsTheHostOnceItIsRegistered(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    Assert.isFalse(fixture.watcher.isAvailable);

    fixture.watcher.start();
    fixture.watcher.start();

    Assert.areEqual(1, fixture.programs.starts.length);
    const monitor = fixture.programs.starts[0];
    Assert.areEqual(GDBUS, monitor?.file);
    Assert.areEqual("monitor --session --dest org.kde.StatusNotifierWatcher", monitor?.programArguments.join(" "));
    Assert.areEqual(fixture.environment, monitor?.environment);
    const query = fixture.programs.runs[0];
    Assert.areEqual(GDBUS, query?.file);
    Assert.areEqual(
      "call --session --dest org.kde.StatusNotifierWatcher --object-path /StatusNotifierWatcher --method org.freedesktop.DBus.Properties.Get org.kde.StatusNotifierWatcher IsStatusNotifierHostRegistered",
      query?.programArguments.join(" "));
    Assert.areEqual(fixture.environment, query?.environment);
    await fixture.programs.answerAsync(REGISTERED);

    Assert.isTrue(fixture.watcher.isAvailable);
    Assert.areEqual("true", fixture.changes.join());
  }

  @TestMethod
  public async findsNoHostWhenTheWatcherSaysNoOrCannotBeAsked(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();

    await fixture.programs.answerAsync(UNREGISTERED);
    fixture.programs.output("NameOwnerChanged");
    await fixture.programs.failAsync();

    Assert.isFalse(fixture.watcher.isAvailable);
    Assert.areEqual(0, fixture.changes.length);
    Assert.areEqual(2, fixture.programs.runs.length);
  }

  @TestMethod
  public async asksAgainOnEveryMonitorMessageAndReportsTheHostLeavingAndComingBack(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    await fixture.programs.answerAsync(REGISTERED);

    fixture.programs.output("StatusNotifierHostUnregistered");
    await fixture.programs.answerAsync(UNREGISTERED);
    fixture.programs.output("StatusNotifierHostRegistered");
    await fixture.programs.answerAsync(REGISTERED);

    Assert.areEqual("true,false,true", fixture.changes.join());
    Assert.areEqual(3, fixture.programs.runs.length);
  }

  @TestMethod
  public async asksOnceMoreForMessagesThatArriveWhileItAsksAndKeepsTheLatestAnswer(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();

    fixture.programs.output("NameOwnerChanged");
    fixture.programs.output("StatusNotifierHostRegistered");
    await fixture.programs.answerAsync(UNREGISTERED);
    Assert.areEqual(2, fixture.programs.runs.length);
    await fixture.programs.answerAsync(REGISTERED);

    Assert.areEqual(2, fixture.programs.runs.length);
    Assert.areEqual(0, fixture.programs.waiting);
    Assert.areEqual("true", fixture.changes.join());
  }

  @TestMethod
  public async restartsTheMonitorAfterItEndsWaitingLongerEachTimeUntilItHearsAgain(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    await fixture.programs.answerAsync(REGISTERED);

    for (const wait of [1000, 2000, 4000]) {
      fixture.programs.exit();
      await fixture.programs.answerAsync(UNREGISTERED);
      Assert.areEqual(wait, fixture.clock.waits.at(-1));
      fixture.clock.advance(wait);
      await FakeProgramHost.settleAsync();
      await fixture.programs.answerAsync(UNREGISTERED);
    }
    fixture.programs.output("NameOwnerChanged");
    await fixture.programs.answerAsync(REGISTERED);
    fixture.programs.exit();
    await fixture.programs.answerAsync(REGISTERED);

    Assert.areEqual("1000,2000,4000,1000", fixture.clock.waits.join());
    Assert.areEqual(4, fixture.programs.starts.length);
    Assert.areEqual("true,false,true", fixture.changes.join());
  }

  @TestMethod
  public async waitsAtMostAMinuteBetweenRestarts(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    await fixture.programs.failAsync();

    for (let attempt = 0; attempt < 8; attempt++) {
      fixture.programs.exit();
      await fixture.programs.failAsync();
      fixture.clock.advance(60_000);
      await FakeProgramHost.settleAsync();
      await fixture.programs.failAsync();
    }

    Assert.areEqual("1000,2000,4000,8000,16000,32000,60000,60000", fixture.clock.waits.join());
    Assert.areEqual(0, fixture.changes.length);
  }

  @TestMethod
  public async stopsTheMonitorAndIgnoresAnswersAndEndsThatArriveAfterward(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    fixture.programs.output("NameOwnerChanged");

    fixture.watcher.stop();
    fixture.programs.exit();
    await fixture.programs.answerAsync(REGISTERED);

    Assert.areEqual(1, fixture.programs.stops);
    Assert.areEqual(1, fixture.programs.runs.length);
    Assert.areEqual(0, fixture.clock.waits.length);
    Assert.areEqual(0, fixture.changes.length);
    Assert.isFalse(fixture.watcher.isAvailable);
  }

  @TestMethod
  public async startsOneMonitorWhenItIsStartedAgainWhileItWaitsToRestart(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    await fixture.programs.answerAsync(REGISTERED);
    fixture.programs.exit();
    await fixture.programs.answerAsync(REGISTERED);

    fixture.watcher.stop();
    fixture.watcher.start();
    await fixture.programs.answerAsync(REGISTERED);
    fixture.clock.advance(1000);
    await FakeProgramHost.settleAsync();

    Assert.areEqual(2, fixture.programs.starts.length);
    Assert.areEqual(0, fixture.programs.waiting);
    Assert.areEqual("true", fixture.changes.join());
  }

  @TestMethod
  public async doesNotRestartWhenItIsStoppedWhileItWaits(): Promise<void> {
    const fixture = new WatcherFixture("linux");
    fixture.watcher.start();
    await fixture.programs.answerAsync(REGISTERED);
    fixture.programs.exit();
    await fixture.programs.answerAsync(REGISTERED);

    fixture.watcher.stop();
    fixture.clock.advance(1000);
    await FakeProgramHost.settleAsync();

    Assert.areEqual(1, fixture.programs.starts.length);
    Assert.areEqual(0, fixture.programs.waiting);
  }
}

@TestClass
export class TrayHostWatcherSessionBusTests {
  @TestMethod
  @PlatformFixture.linuxOnly()
  public findsNoHostWithoutAWatcherAndFindsItOnceAWatcherWithAHostAppears(): Promise<void> {
    return TrayHostWatcherSessionBusTests.runOnBusAsync(async (bus, programs, watcher, changes) => {
      watcher.start();
      await Condition.waitAsync(() => programs.answered > 0);
      Assert.isFalse(watcher.isAvailable);

      const fixture = await StatusNotifierWatcherFixture.connectAsync(bus.address, true);

      await Condition.waitAsync(() => watcher.isAvailable);
      Assert.areEqual("true", changes.join());
      await fixture.leaveAsync();
    });
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public followsTheHostRegisteringAndLeavingAndTheWatcherLeaving(): Promise<void> {
    return TrayHostWatcherSessionBusTests.runOnBusAsync(async (bus, _programs, watcher, changes) => {
      const fixture = await StatusNotifierWatcherFixture.connectAsync(bus.address, false);
      watcher.start();
      await Condition.waitAsync(() => fixture.gets > 0);
      Assert.isFalse(watcher.isAvailable);

      fixture.setHost(true);
      await Condition.waitAsync(() => watcher.isAvailable);
      fixture.setHost(false);
      await Condition.waitAsync(() => !watcher.isAvailable);
      fixture.setHost(true);
      await Condition.waitAsync(() => watcher.isAvailable);
      await fixture.leaveAsync();
      await Condition.waitAsync(() => !watcher.isAvailable);

      Assert.areEqual("true,false,true,false", changes.join());
    });
  }

  private static async runOnBusAsync(test: (bus: PrivateSessionBus, programs: CountingProgramHost, watcher: TrayHostWatcher, changes: boolean[]) => Promise<void>): Promise<void> {
    const bus = await PrivateSessionBus.startAsync();
    const programs = new CountingProgramHost();
    const changes: boolean[] = [];
    const clock = new FakeClock();
    const watcher = new TrayHostWatcher("linux", programs, bus.environment(), t => clock.waitAsync(t, new AbortController().signal), t => changes.push(t));
    try {
      await test(bus, programs, watcher, changes);
    }
    finally {
      watcher.stop();
      await bus.stopAsync();
    }
  }
}
