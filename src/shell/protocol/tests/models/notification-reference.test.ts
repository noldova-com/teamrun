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
import { NotificationReference } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationReferenceTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual(4, NotificationReference.fromJson({ id: 4 }).id);
    Assert.areEqual("{\"id\":4}", JSON.stringify(new NotificationReference(4).toJson()));
  }

  @TestMethod
  public refusesAnInvalidIdAndUnknownFields(): void {
    Assert.areEqual("id", Assert.throws(() => new NotificationReference(-1), ArgumentException).parameterName);
    Assert.areEqual("$.id", Assert.throws(() => NotificationReference.fromJson({ id: "4" }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationReference.fromJson({ id: 4, extra: 1 }), JsonException).path);
  }
}
