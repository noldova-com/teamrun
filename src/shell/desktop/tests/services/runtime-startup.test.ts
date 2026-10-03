/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, PreShellData, QualifiedName, RunningWork, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, LaunchException, PreShellDataFoundException, RuntimeHandoverException, WorkInProgressException } from "@noldova/teamrun-shell-runtime";
import { RuntimeStartup, type StartupState } from "@noldova/teamrun-shell-desktop";

import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class RuntimeStartupTests {
  private static readonly HANDOVER: RuntimeHandover = new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun");

  private readonly published: string[] = [];
  private readonly handedOver: string[] = [];
  private readonly events: string[] = [];

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
    Assert.isTrue(await startup.actAsync("wait"));

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
    const startup = this.create(launcher, 20);

    await startup.startAsync();
    const waiting = startup.actAsync("wait");
    await setImmediate();
    startup.close();

    Assert.isTrue(await waiting);
    Assert.areEqual(2, launcher.calls.length);
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
  }

  @TestMethod
  public async handsOverToANewerBuildOrSaysOneIsRunning(): Promise<void> {
    const handingOver = this.create(new FakeRuntimeLauncher(new RuntimeHandoverException(RuntimeStartupTests.HANDOVER)), 1, true);
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
  public async letsUnexpectedFailuresThrough(): Promise<void> {
    const startup = this.create(new FakeRuntimeLauncher(new TypeError("A defect.")));

    await Assert.throwsAsync(() => startup.startAsync(), TypeError);
  }

  @TestMethod
  public async reconnectsWhenTheRuntimeDisconnects(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), null));
    launcher.listener?.onDisconnected();
    await setImmediate();

    Assert.areEqual(2, launcher.calls.length);
    Assert.areEqual("Ready", startup.current.kind);
    Assert.areEqual(JSON.stringify(["notes.changed"]), JSON.stringify(this.events));
  }

  @TestMethod
  public async offersToTryAgainWhenReconnectingFailsUnexpectedly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new FakeRuntimeConnection(), new Error("ENOENT: no such file or directory, open 'runtime.json'"));
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onDisconnected();
    await setImmediate();
    const failed = startup.current.toJson();
    Assert.isTrue(await startup.actAsync("retry"));

    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["Error: ENOENT: no such file or directory, open 'runtime.json'"] }), JSON.stringify(failed));
    Assert.areEqual(JSON.stringify(["Connecting", "Ready", "Connecting", "Failed", "Connecting", "Ready"]), JSON.stringify(this.published));
    Assert.areEqual(3, launcher.calls.length);
  }

  @TestMethod
  public async ignoresTheEndOfARefusedConnection(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    const startup = this.create(launcher);

    await startup.startAsync();
    launcher.listener?.onDisconnected();
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
    launcher.listener?.onDisconnected();
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

  private create(launcher: FakeRuntimeLauncher, waitInterval: number = 1, handsOver: boolean = false): RuntimeStartup {
    return new RuntimeStartup(
      launcher,
      (t: StartupState) => this.published.push(t.kind),
      t => {
        this.handedOver.push(t.identity.productVersion);
        return handsOver;
      },
      waitInterval,
      t => this.events.push(t.name.text));
  }
}
