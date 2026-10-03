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
import { DoNotDisturbChange } from "@noldova/teamrun-shell-protocol";

@TestClass
export class DoNotDisturbChangeTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const change = DoNotDisturbChange.fromJson({ device: "laptop", isOn: true });

    Assert.areEqual("laptop|true", `${change.device}|${String(change.isOn)}`);
    Assert.areEqual("{\"device\":\"laptop\",\"isOn\":false}", JSON.stringify(new DoNotDisturbChange("laptop", false).toJson()));
  }

  @TestMethod
  public refusesABlankDeviceAndInvalidFields(): void {
    Assert.areEqual("device", Assert.throws(() => new DoNotDisturbChange(" ", true), ArgumentException).parameterName);
    Assert.areEqual("$.isOn", Assert.throws(() => DoNotDisturbChange.fromJson({ device: "laptop", isOn: "yes" }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => DoNotDisturbChange.fromJson({ device: "laptop", isOn: true, extra: 1 }), JsonException).path);
  }
}
