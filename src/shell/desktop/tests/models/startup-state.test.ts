/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StartupState, StartupStateKind } from "@noldova/teamrun-shell-desktop";

@TestClass
export class StartupStateTests {
  @TestMethod
  public namesEachStageWithItsDetails(): void {
    const states = [
      StartupState.connecting(),
      StartupState.preShellData("/data"),
      StartupState.workInProgress(["Indexing the project"]),
      StartupState.waitingForWork(["Indexing the project", "Building"]),
      StartupState.newerBuild("2.0.0"),
      StartupState.failed("The runtime could not start."),
      StartupState.updating("0.3.0"),
      StartupState.ready()
    ];

    Assert.areEqual(
      JSON.stringify([
        { kind: StartupStateKind.Connecting, details: [] },
        { kind: StartupStateKind.PreShellData, details: ["/data"] },
        { kind: StartupStateKind.WorkInProgress, details: ["Indexing the project"] },
        { kind: StartupStateKind.WaitingForWork, details: ["Indexing the project", "Building"] },
        { kind: StartupStateKind.NewerBuild, details: ["2.0.0"] },
        { kind: StartupStateKind.Failed, details: ["The runtime could not start."] },
        { kind: StartupStateKind.Updating, details: ["0.3.0"] },
        { kind: StartupStateKind.Ready, details: [] }
      ]),
      JSON.stringify(states.map(t => ({ kind: t.kind, details: t.details }))));
    Assert.areEqual(JSON.stringify(states.map(t => ({ kind: t.kind, details: t.details }))), JSON.stringify(states.map(t => t.toJson())));
  }

  @TestMethod
  public keepsItsOwnCopyOfTheDetails(): void {
    const descriptions = ["Indexing the project"];

    const state = StartupState.workInProgress(descriptions);
    descriptions.push("Building");

    Assert.areEqual(JSON.stringify(["Indexing the project"]), JSON.stringify(state.details));
  }
}
