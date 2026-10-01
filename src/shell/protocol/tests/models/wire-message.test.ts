/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Cancel, WireMessage } from "@noldova/teamrun-shell-protocol";

@TestClass
export class WireMessageTests {
  @TestMethod
  public putsTheKindFirstAndWritesOneLine(): void {
    const message: WireMessage = new Cancel("line\nbreak");

    Assert.areEqual("kind,id", Object.keys(message.toJson()).join(","));
    Assert.isFalse(message.toText().includes("\n"));
    Assert.areEqual("{\"kind\":\"Cancel\",\"id\":\"line\\nbreak\"}", message.toText());
  }
}
