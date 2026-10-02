/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event, QualifiedName, WireMessageKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class EventTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const event = Event.fromJson(new Event(QualifiedName.parse("shell.layoutChanged"), [1, "two"]).toJson());

    Assert.areEqual(WireMessageKind.Event, event.kind);
    Assert.areEqual("shell.layoutChanged", event.name.text);
    Assert.areEqual("[1,\"two\"]", JSON.stringify(event.payload));
    Assert.areEqual("{\"kind\":\"Event\",\"name\":\"shell.layoutChanged\",\"payload\":[1,\"two\"]}", event.toText());
  }

  @TestMethod
  public namesAnInvalidNameOnTheWire(): void {
    Assert.areEqual("$.name", Assert.throws(() => Event.fromJson({ name: "layoutChanged", payload: null }), JsonException).path);
  }
}
