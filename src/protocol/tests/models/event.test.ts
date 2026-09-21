/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event, WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class EventTests {
  @TestMethod
  public carriesNameAndPayload(): void {
    const event = new Event("turn.updated", { id: "turn1", status: "Running" });

    Assert.areEqual(WireMessageKind.Event, event.kind);
    Assert.areEqual("turn.updated", event.name);
    Assert.areEqual("{\"id\":\"turn1\",\"status\":\"Running\"}", JSON.stringify(event.payload));
  }

  @TestMethod
  public rejectsABlankName(): void {
    Assert.throws(() => new Event(String.empty, null), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJsonIncludingNullPayload(): void {
    const event = Event.fromJson(new Event("runtime.ready", null).toJson());

    Assert.areEqual("runtime.ready", event.name);
    Assert.isNull(event.payload);
  }

  @TestMethod
  public requiresNameAndPayload(): void {
    Assert.areEqual("$.name", Assert.throws(() => Event.fromJson({ payload: null }), JsonException).path);
    Assert.areEqual("$.payload", Assert.throws(() => Event.fromJson({ name: "runtime.ready" }), JsonException).path);
  }
}
