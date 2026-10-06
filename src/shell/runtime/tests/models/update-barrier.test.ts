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
    const text = "{\"holder\":{\"processId\":4120,\"earliest\":1500,\"latest\":1501,\"role\":\"desktop\"},\"version\":\"0.3.0\",\"state\":\"Closing\",\"handoff\":null}";
    const handedOff = "{\"holder\":{\"processId\":4120,\"earliest\":1500,\"latest\":1501,\"role\":\"desktop\"},\"version\":\"0.3.0\",\"state\":\"HandedOff\",\"handoff\":{\"processId\":5200,\"earliest\":1600,\"latest\":1601,\"role\":\"handoff\"}}";

    const barrier = UpdateBarrier.fromJson(JSON.parse(text));
    const handed = UpdateBarrier.fromJson(JSON.parse(handedOff));

    Assert.areEqual(text, JSON.stringify(new UpdateBarrier(new UpdateProcess(4120, 1500, 1501, "desktop"), "0.3.0", UpdateBarrierState.Closing, null).toJson()));
    Assert.areEqual(text, JSON.stringify(barrier.toJson()));
    Assert.areEqual(handedOff, JSON.stringify(handed.toJson()));
    Assert.areEqual(UpdateBarrierState.Closing, barrier.state);
    Assert.areEqual(4120, barrier.holder.processId);
    Assert.isNull(barrier.handoff);
    Assert.areEqual(5200, handed.handoff?.processId);
  }

  @TestMethod
  public rejectsAnInvalidHolderVersionOrStateOrAnUnknownField(): void {
    const holder = { processId: 4120, earliest: 1500, latest: 1501, role: "desktop" };

    Assert.areEqual("$.holder.latest", Assert.throws(() => UpdateBarrier.fromJson({ holder: { ...holder, latest: 1 }, version: "0.3.0", state: "Closing", handoff: null }), JsonException).path);
    Assert.areEqual("$.version", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: " ", state: "Closing", handoff: null }), JsonException).path);
    Assert.areEqual("$.state", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "done", handoff: null }), JsonException).path);
    Assert.areEqual("$.handoff.latest", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "HandedOff", handoff: { ...holder, latest: 1 } }), JsonException).path);
    Assert.areEqual("$.handoff", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "Closing" }), JsonException).path);
    Assert.areEqual("$.done", Assert.throws(() => UpdateBarrier.fromJson({ holder, version: "0.3.0", state: "Closing", handoff: null, done: true }), JsonException).path);
  }
}
