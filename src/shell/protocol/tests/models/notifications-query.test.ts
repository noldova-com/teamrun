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
import { NotificationsQuery } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationsQueryTests {
  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual("laptop", NotificationsQuery.fromJson({ device: "laptop" }).device);
    Assert.areEqual("{\"device\":\"laptop\"}", JSON.stringify(new NotificationsQuery("laptop").toJson()));
  }

  @TestMethod
  public refusesABlankDeviceAndUnknownFields(): void {
    Assert.areEqual("device", Assert.throws(() => new NotificationsQuery(""), ArgumentException).parameterName);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationsQuery.fromJson({ device: "laptop", extra: 1 }), JsonException).path);
  }
}
