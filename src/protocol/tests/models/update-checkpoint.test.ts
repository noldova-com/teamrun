/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateCheckpoint, UpdateCheckpointPhase, UpdateCheckpointResult, UpdateOperation, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

@TestClass
export class UpdateCheckpointTests {
  @TestMethod
  public validatesAndRoundTripsRestartMessagesAndOlderSnapshots(): void {
    for (const phase of Object.values(UpdateCheckpointPhase)) {
      const value = new UpdateCheckpoint("op", phase);
      Assert.areEqual(JSON.stringify(value.toJson()), JSON.stringify(UpdateCheckpoint.fromJson(value.toJson()).toJson()));
    }
    for (const ready of [false, true]) {
      const value = new UpdateCheckpointResult("op", ready);
      Assert.areEqual(ready, UpdateCheckpointResult.fromJson(value.toJson()).ready);
    }
    Assert.areEqual("op", UpdateOperation.fromJson(new UpdateOperation("op").toJson()).id);
    Assert.throws(() => UpdateCheckpoint.fromJson({ id: "x", phase: "Unknown" }), Error);
    Assert.throws(() => UpdateCheckpointResult.fromJson({ id: "x", ready: "yes" }), Error);
    Assert.throws(() => new UpdateOperation(" "), Error);
    const snapshot = new AppUpdateState(AppUpdateStatus.Downloaded, "1", "2", 100, null, null, true, true).toJson();
    Assert.isTrue(AppUpdateState.fromJson(snapshot).canInstall);
    const oldSnapshot = { ...snapshot };
    delete oldSnapshot["canInstall"];
    Assert.isFalse(AppUpdateState.fromJson(oldSnapshot).canInstall);
  }
}
