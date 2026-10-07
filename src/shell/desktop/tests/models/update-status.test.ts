/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateStateKind, UpdateStatus } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UpdateStatusTests {
  @TestMethod
  public givesItsFieldsAsTheWindowReadsThem(): void {
    const status = new UpdateStatus(UpdateStateKind.Downloading, "1.3.0", 42, 1_000, null, false);

    Assert.areEqual(JSON.stringify({ kind: "Downloading", version: "1.3.0", progress: 42, checkedAt: 1_000, reason: null, mustMove: false }), JSON.stringify(status.toJson()));
    Assert.areEqual(JSON.stringify({ kind: "Off", version: null, progress: null, checkedAt: null, reason: null, mustMove: false }), JSON.stringify(UpdateStatus.off.toJson()));
  }

  @TestMethod
  public isBusyWhileCheckingDownloadingOrReady(): void {
    const busy = (kind: UpdateStateKind): boolean => new UpdateStatus(kind, null, null, null, null, false).isBusy;

    Assert.areEqual(
      JSON.stringify([false, false, true, false, true, true, false]),
      JSON.stringify([UpdateStateKind.Off, UpdateStateKind.UpToDate, UpdateStateKind.Checking, UpdateStateKind.Available, UpdateStateKind.Downloading, UpdateStateKind.Ready, UpdateStateKind.Failed]
        .map(busy)));
  }
}
