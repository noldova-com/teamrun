/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

@TestClass
export class AppUpdateStateTests {
  @TestMethod
  public roundTripsEveryStatusAndRejectsMalformedSnapshots(): void {
    for (const status of Object.values(AppUpdateStatus)) {
      const state = new AppUpdateState(status, "0.0.1", "0.0.2", 42, "message", "2026-09-16T00:00:00Z", true);
      Assert.areEqual(JSON.stringify(state.toJson()), JSON.stringify(AppUpdateState.fromJson(state.toJson()).toJson()));
    }
    const empty = new AppUpdateState(AppUpdateStatus.Idle, "0.0.1", null, null, null, null, false);
    Assert.areEqual(JSON.stringify(empty.toJson()), JSON.stringify(AppUpdateState.fromJson(empty.toJson()).toJson()));
    Assert.throws(() => new AppUpdateState(AppUpdateStatus.Idle, " ", null, null, null, null, false), ArgumentException);
    Assert.throws(() => new AppUpdateState(AppUpdateStatus.Available, "0.0.1", " ", null, null, null, false), ArgumentException);
    for (const progress of [-1, 101, 0.5, Number.NaN])
      Assert.throws(() => new AppUpdateState(AppUpdateStatus.Downloading, "0.0.1", "0.0.2", progress, null, null, true), ArgumentException);
    Assert.throws(() => AppUpdateState.fromJson({ ...empty.toJson(), status: "Install" }), JsonException);
    Assert.throws(() => AppUpdateState.fromJson({ ...empty.toJson(), progressPercent: "42" }), JsonException);
    Assert.throws(() => AppUpdateState.fromJson({ status: "Idle" }), JsonException);
  }
}
