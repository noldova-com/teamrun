/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, Failure, FailureCode, PreShellData, QualifiedName, RunningWork, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, LaunchException, PreShellDataFoundException, RuntimeHandoverException, WorkInProgressException } from "@noldova/teamrun-shell-runtime";
import { RuntimeStartup, type StartupState } from "@noldova/teamrun-shell-desktop";

import { FakeClock } from "../fixtures/fake-clock.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class RuntimeStartupTests {
  private static readonly HANDOVER: RuntimeHandover = new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun");
  private static readonly WAIT_INTERVAL: number = 2000;
  private static readonly INVALID: Failure = new Failure(FailureCode.InvalidMessage, "A frame is not a valid message.");

  private readonly published: string[] = [];
  private readonly handedOver: string[] = [];
  private readonly events: string[] = [];
  private readonly logged: string[] = [];
  private readonly clock: FakeClock = new FakeClock();

  @TestMethod
  public async attachesAndReportsTheWindowReady(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    Assert.areEqual("Connecting", startup.current.kind);
    await startup.startAsync();

    Assert.areEqual(JSON.stringify(["attach desktop IfIdle"]), JSON.stringify(launcher.calls));
    Assert.areEqual(JSON.stringify(["Connecting", "Ready"]), JSON.stringify(this.published));
    Assert.areEqual(JSON.stringify({ kind: "Ready", details: [] }), JSON.stringify(startup.current.toJson()));
  }

  @TestMethod
  public async showsDataFromBeforeTheShellAndMovesItAsideOnRequest(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    const startup = this.create(launcher);

    await startup.startAsync();
    Assert.areEqual(JSON.stringify({ kind: "PreShellData", details: ["/data/old"] }), JSON.stringify(startup.current.toJson()));
    Assert.isTrue(await startup.actAsync("moveAside"));

    Assert.areEqual(JSON.stringify(["attach desktop IfIdle", "moveAside desktop IfIdle"]), JSON.stringify(launcher.calls));
    Assert.areEqual("Ready", startup.current.kind);
  }

  @TestMethod
  public async stopsAnOlderBuildsWorkWhenThePersonChoosesTo(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new WorkInProgressException(new RunningWork(["A reply"])));
    const startup = this.create(launcher);

    await startup.startAsync();
    Assert.areEqual(JSON.stringify({ kind: "WorkInProgress", details: ["A reply"] }), JSON.stringify(startup.current.toJson()));
    Assert.isTrue(await startup.actAsync("stopWork"));

    Assert.areEqual(JSON.stringify(["attach desktop IfIdle", "attach desktop StopWork"]), JSON.stringify(launcher.calls));
    Assert.areEqual("Ready", startup.current.kind);
  }

  @TestMethod
  public async waitsForAnOlderBuildsWorkToFinish(): Promise<void> {
    const busy = (): WorkInProgressException => new WorkInProgressException(new RunningWork(["A reply", "A command"]));
    const launcher = new FakeRuntimeLauncher(busy(), busy(), busy());
    const startup = this.create(launcher);

    await startup.startAsync();
    const waiting = startup.actAsync("wait");
    for (let pause = 0; pause < 2; pause++) {
      await setImmediate();
      this.clock.advance(RuntimeStartupTests.WAIT_INTERVAL);
    }

    Assert.isTrue(await waiting);
    Assert.areEqual(JSON.stringify([2000, 2000]), JSON.stringify(this.clock.waits));
    Assert.areEqual(4, launcher.calls.length);
    Assert.isTrue(launcher.calls.every(t => t === "attach desktop IfIdle"));
    Assert.areEqual(JSON.stringify(["Connecting", "WorkInProgress", "WaitingForWork", "WaitingForWork", "Ready"]), JSON.stringify(this.published));
  }

  @TestMethod
  public async stopsWaitingWhenWaitingEndsInAnotherRefusal(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new WorkInProgressException(new RunningWork(["A reply"])), new LaunchException("The older runtime did not stop."));
    const startup = this.create(launcher);

    await startup.startAsync();
    await startup.actAsync("wait");

    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["The older runtime did not stop."] }), JSON.stringify(startup.current.toJson()));
  }

  @TestMethod
  public async stopsWaitingWhenTheApplicationCloses(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new WorkInProgressException(new RunningWork(["A reply"])), new WorkInProgressException(new RunningWork(["A reply"])));
    const startup = this.create(launcher);

    await startup.startAsync();
    const waiting = startup.actAsync("wait");
    await setImmediate();
    startup.close();

    Assert.isTrue(await waiting);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual(2, launcher.calls.length);
  }

  @TestMethod
  public async passesOnAWaitThatFailsWhileOpen(): Promise<void> {
    const busy = (): WorkInProgressException => new WorkInProgressException(new RunningWork(["A reply"]));
    const startup = this.create(new FakeRuntimeLauncher(busy(), busy()), false, () => Promise.reject(new RangeError("The timer failed.")));

    await startup.startAsync();
    const failure = await Assert.throwsAsync(() => startup.actAsync("wait"), RangeError);

    Assert.areEqual("The timer failed.", failure.message);
  }

  @TestMethod
  public async offersToTryAgainAfterAFailedLaunchOrConnection(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new LaunchException("The runtime did not start in time."), new ConnectionException("The runtime refused the connection."));
    const startup = this.create(launcher);

    await startup.startAsync();
    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["The runtime did not start in time."] }), JSON.stringify(startup.current.toJson()));
    Assert.isTrue(await startup.actAsync("retry"));
    Assert.areEqual("The runtime refused the connection.", startup.current.details[0]);
    Assert.isTrue(await startup.actAsync("retry"));

    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(
      JSON.stringify([
        "The runtime could not be started or reached, so the window offers to try again: The runtime did not start in time.",
        "The runtime could not be started or reached, so the window offers to try again: The runtime refused the connection."
      ]),
      JSON.stringify(this.logged));
  }

  @TestMethod
  public async handsOverToANewerBuildOrSaysOneIsRunning(): Promise<void> {
    const handingOver = this.create(new FakeRuntimeLauncher(new RuntimeHandoverException(RuntimeStartupTests.HANDOVER)), true);
    const showing = this.create(new FakeRuntimeLauncher(new RuntimeHandoverException(RuntimeStartupTests.HANDOVER)));

    await handingOver.startAsync();
    await showing.startAsync();

    Assert.areEqual("Connecting", handingOver.current.kind);
    Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(showing.current.toJson()));
    Assert.areEqual(JSON.stringify(["2.0.0", "2.0.0"]), JSON.stringify(this.handedOver));
  }

  @TestMethod
  public async refusesActionsThatDoNotFitTheCurrentState(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    const startup = this.create(launcher);

    await startup.startAsync();

    for (const action of ["stopWork", "wait", "retry", "quit", 1])
      Assert.isFalse(await startup.actAsync(action));
    Assert.areEqual(1, launcher.calls.length);
  }

  @TestMethod
  public async logsAnUnexpectedFailureInFullAndOffersToTryAgain(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new TypeError("A defect."));
    const startup = this.create(launcher);

    await startup.startAsync();
    const failed = startup.current.toJson();
    Assert.isTrue(await startup.actAsync("retry"));

    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["TypeError: A defect."] }), JSON.stringify(failed));
    Assert.areEqual(1, this.logged.length);
    Assert.isTrue(String(this.logged[0]).startsWith("The runtime could not be started or reached, so the window offers to try again: TypeError: A defect.\n    at "));
    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(2, launcher.calls.length);
  }

  @TestMethod
  public async reconnectsWhenTheRuntimeDisconnects(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), null));
    launcher.listener?.onDisconnected(new Failure(FailureCode.FrameTooLarge, "A frame exceeds the maximum length of 16777216 characters."));
    await setImmediate();

    Assert.areEqual(2, launcher.calls.length);
    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(JSON.stringify(["notes.changed"]), JSON.stringify(this.events));
    Assert.areEqual(
      JSON.stringify(["The desktop ended its connection to the runtime, so it connects again (FrameTooLarge): A frame exceeds the maximum length of 16777216 characters."]),
      JSON.stringify(this.logged));
  }

  @TestMethod
  public async waitsLongerBeforeEachReconnectionWhileConnectionsEndSoonAfterConnecting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    for (const delay of [0, 1000, 2000, 4000, 8000]) {
      launcher.listener?.onDisconnected(RuntimeStartupTests.INVALID);
      await setImmediate();
      if (delay > 0) {
        this.clock.advance(delay - 1);
        await setImmediate();
        Assert.areEqual("Connecting", startup.current.kind);
        this.clock.advance(1);
        await setImmediate();
      }
      Assert.areEqual("Ready", startup.current.kind);
    }

    Assert.areEqual(JSON.stringify([1000, 2000, 4000, 8000]), JSON.stringify(this.clock.waits));
    Assert.areEqual(6, launcher.calls.length);
    Assert.areEqual(12, this.published.length);
    Assert.isTrue(this.published.every((t, i) => t === (i % 2 === 0 ? "Connecting" : "Ready")));
  }

  @TestMethod
  public async stopsOnTheSixthEndInARowWithTheLastCauseAndStartsAfreshOnRetry(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    for (let end = 0; end < 5; end++)
      await this.endSoonAsync(launcher, null);
    await this.endSoonAsync(launcher, RuntimeStartupTests.INVALID);
    const stopped = startup.current.toJson();
    this.clock.advance(60000);
    await setImmediate();
    const callsWhileStopped = launcher.calls.length;
    Assert.isTrue(await startup.actAsync("retry"));
    await this.endSoonAsync(launcher, null);

    const details = "The connection to the runtime ended 6 times in a row, each within 30 seconds of connecting, so the desktop stopped connecting again. The last time, the desktop ended it (InvalidMessage): A frame is not a valid message.";
    Assert.areEqual(JSON.stringify({ kind: "Failed", details: [details] }), JSON.stringify(stopped));
    Assert.areEqual(6, callsWhileStopped);
    Assert.areEqual(JSON.stringify([`The runtime could not be started or reached, so the window offers to try again: ${details}`]), JSON.stringify(this.logged));
    Assert.areEqual(JSON.stringify([1000, 2000, 4000, 8000]), JSON.stringify(this.clock.waits));
    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(8, launcher.calls.length);
  }

  @TestMethod
  public async saysTheRuntimeEndedTheLastConnectionWhenItStops(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    for (let end = 0; end < 6; end++)
      await this.endSoonAsync(launcher, null);

    Assert.areEqual("Failed", startup.current.kind);
    Assert.isTrue(startup.current.details[0]?.endsWith("so the desktop stopped connecting again. The last time, the runtime ended it.") === true);
    Assert.areEqual(6, launcher.calls.length);
  }

  @TestMethod
  public async reconnectsAtOnceAgainAfterAConnectionStaysReadyFor30Seconds(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    await this.endSoonAsync(launcher, null);
    await this.endSoonAsync(launcher, null);
    this.clock.advance(29999);
    await this.endSoonAsync(launcher, null);
    this.clock.advance(30000);
    launcher.listener?.onDisconnected(null);
    await setImmediate();

    Assert.areEqual(JSON.stringify([1000, 2000]), JSON.stringify(this.clock.waits));
    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(5, launcher.calls.length);
  }

  @TestMethod
  public async closingDuringAReconnectionWaitEndsTheWait(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    await this.endSoonAsync(launcher, null);
    launcher.listener?.onDisconnected(null);
    await setImmediate();
    const pending = this.clock.pending;
    startup.close();
    this.clock.advance(1000);
    await setImmediate();

    Assert.areEqual(1, pending);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual("Connecting", startup.current.kind);
    Assert.areEqual(2, launcher.calls.length);
  }

  @TestMethod
  public async offersToTryAgainWhenReconnectingFailsUnexpectedly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new FakeRuntimeConnection(), new Error("ENOENT: no such file or directory, open 'runtime.json'"));
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onDisconnected(null);
    await setImmediate();
    const failed = startup.current.toJson();
    Assert.isTrue(await startup.actAsync("retry"));

    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["Error: ENOENT: no such file or directory, open 'runtime.json'"] }), JSON.stringify(failed));
    Assert.areEqual(1, this.logged.length);
    Assert.areEqual(JSON.stringify(["Connecting", "Ready", "Connecting", "Failed", "Connecting", "Ready"]), JSON.stringify(this.published));
    Assert.areEqual(3, launcher.calls.length);
  }

  @TestMethod
  public async ignoresTheEndOfARefusedConnection(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onDisconnected(null);
    await setImmediate();

    Assert.areEqual(1, launcher.calls.length);
    Assert.areEqual("PreShellData", startup.current.kind);
  }

  @TestMethod
  public async closesItsConnectionAndOneThatArrivesAfterClosing(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    startup.close();
    launcher.listener?.onDisconnected(null);
    const lateConnection = new FakeRuntimeConnection();
    const late = this.create(new FakeRuntimeLauncher(lateConnection));
    const arriving = late.startAsync();
    late.close();
    await arriving;

    Assert.isTrue(launcher.connections[0]?.isClosed === true);
    Assert.areEqual(1, launcher.calls.length);
    Assert.isTrue(lateConnection.isClosed);
    Assert.areEqual("Connecting", late.current.kind);
  }

  private async endSoonAsync(launcher: FakeRuntimeLauncher, failure: Failure | null): Promise<void> {
    launcher.listener?.onDisconnected(failure);
    await setImmediate();
    if (this.clock.pending > 0)
      this.clock.advance(this.clock.waits.at(-1) ?? 0);
    await setImmediate();
  }

  private create(
    launcher: FakeRuntimeLauncher,
    handsOver: boolean = false,
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void> = (t, signal) => this.clock.waitAsync(t, signal)): RuntimeStartup {
    return new RuntimeStartup(
      launcher,
      (t: StartupState) => this.published.push(t.kind),
      t => {
        this.handedOver.push(t.identity.productVersion);
        return handsOver;
      },
      RuntimeStartupTests.WAIT_INTERVAL,
      t => this.events.push(t.name.text),
      t => this.logged.push(t),
      () => this.clock.now(),
      wait);
  }
}
