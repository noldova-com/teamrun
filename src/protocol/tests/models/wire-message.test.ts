/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event, WireMessage, WireMessageKind } from "@noldova/teamrun-protocol";

@TestClass
export class WireMessageTests {
  @TestMethod
  public writesTheKindBeforeTheFields(): void {
    const message: WireMessage = new Event("run.updated", { id: "run1" });

    Assert.areEqual("{\"kind\":\"Event\",\"name\":\"run.updated\",\"payload\":{\"id\":\"run1\"}}", message.toText());
    Assert.areEqual(WireMessageKind.Event, message.toJson()["kind"]);
  }

  @TestMethod
  public textIsTheJsonInOneLine(): void {
    const message: WireMessage = new Event("run.updated", null);

    Assert.areEqual(JSON.stringify(message.toJson()), message.toText());
    Assert.isFalse(message.toText().includes("\n"));
  }
}
