/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

@TestClass
export class UpdateBarrierTests {
  @TestMethod
  public pinsItsFileForm(): void {
    const text = "{\"holder\":{\"processId\":4120,\"earliest\":1500,\"latest\":1501,\"role\":\"desktop\"},\"version\":\"0.3.0\",\"state\":\"HandedOff\"}";

    const barrier = UpdateBarrier.fromJson(JSON.parse(text));

    Assert.areEqual(text, JSON.stringify(new UpdateBarrier(new UpdateProcess(4120, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.HandedOff).toJson()));
    Assert.areEqual(text, JSON.stringify(barrier.toJson()));
    Assert.areEqual(UpdateBarrierState.HandedOff, barrier.state);
    Assert.areEqual(4120, barrier.holder.processId);
  }

  @TestMethod
  public rejectsAnInvalidHolderVersionOrStateOrAnUnknownField(): void {
    const holder = { processId: 4120, earliest: 1500, latest: 1501, role: "desktop" };

    Assert.areEqual("$.holder.latest", Assert.throws(() => UpdateBarrier.fromJson({ holder: { ...holder, latest: 1 }, version: "0.3.0", state: "Closing" }), JsonException).path);
    Assert.areEqual("$.version", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: " ", state: "Closing" }), JsonException).path);
    Assert.areEqual("$.state", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "done" }), JsonException).path);
    Assert.areEqual("$.done", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "Closing", done: true }), JsonException).path);
  }
}
