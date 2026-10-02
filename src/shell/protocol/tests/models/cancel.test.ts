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
import { Cancel, WireMessageKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class CancelTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const cancel = Cancel.fromJson(new Cancel("r1").toJson());

    Assert.areEqual(WireMessageKind.Cancel, cancel.kind);
    Assert.areEqual("r1", cancel.id);
    Assert.areEqual("{\"kind\":\"Cancel\",\"id\":\"r1\"}", cancel.toText());
  }

  @TestMethod
  public rejectsABlankId(): void {
    Assert.throws(() => new Cancel(" "), ArgumentException);
    Assert.areEqual("$.id", Assert.throws(() => Cancel.fromJson({ id: "" }), JsonException).path);
  }
}
