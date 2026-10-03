/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WorkTracker } from "@noldova/teamrun-shell-runtime";

@TestClass
export class WorkTrackerTests {
  @TestMethod
  public tracksWorkUntilItIsDisposed(): void {
    let changes = 0;
    const tracker = new WorkTracker(() => changes++);
    Assert.isTrue(tracker.isEmpty);

    const indexing = tracker.begin("Indexing the project");
    const running = tracker.begin("Running the tests");

    Assert.isFalse(tracker.isEmpty);
    Assert.areEqual("Indexing the project,Running the tests", tracker.descriptions.join(","));
    indexing[Symbol.dispose]();
    indexing[Symbol.dispose]();
    Assert.areEqual("Running the tests", tracker.descriptions.join(","));
    const report = tracker.report;
    running[Symbol.dispose]();
    Assert.isTrue(tracker.isEmpty);
    Assert.areEqual(4, changes);
    Assert.areEqual("Running the tests|3", `${report.descriptions.join(",")}|${report.sequence}`);
    Assert.areEqual(4, tracker.report.sequence);
  }

  @TestMethod
  public abortsAndEndsOnlyTheItemsOfOneOwner(): void {
    let changes = 0;
    const tracker = new WorkTracker(() => changes++);
    const shell = tracker.begin("Backing up");
    const saving = tracker.begin("Saving the notes", "notes");
    const indexing = tracker.begin("Indexing the notes", "notes");
    const syncing = tracker.begin("Syncing the tasks", "tasks");

    tracker.endOwnedBy("notes");
    tracker.endOwnedBy("notes");
    saving[Symbol.dispose]();

    Assert.areEqual("Backing up,Syncing the tasks", tracker.descriptions.join(","));
    Assert.isTrue(saving.signal.aborted);
    Assert.isTrue(indexing.signal.aborted);
    Assert.isFalse(shell.signal.aborted);
    Assert.isFalse(syncing.signal.aborted);
    Assert.areEqual(5, changes);
  }

  @TestMethod
  public cancelsEveryItem(): void {
    const tracker = new WorkTracker(() => undefined);
    const first = tracker.begin("first");
    const second = tracker.begin("second");

    tracker.cancelAll();

    Assert.isTrue(first.signal.aborted);
    Assert.isTrue(second.signal.aborted);
    Assert.isFalse(tracker.isEmpty);
  }
}
