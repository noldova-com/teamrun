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
import { KeptRuntime } from "@noldova/teamrun-shell-protocol";

@TestClass
export class KeptRuntimeTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"keptFor\":2}";

    Assert.areEqual(text, JSON.stringify(new KeptRuntime(2).toJson()));
    Assert.areEqual(2, KeptRuntime.fromJson(JSON.parse(text)).keptFor);
  }

  @TestMethod
  public rejectsACountBelowOneOrNotWholeAndUnknownFields(): void {
    Assert.throws(() => new KeptRuntime(0), ArgumentException);
    Assert.throws(() => new KeptRuntime(1.5), ArgumentException);
    Assert.areEqual("$.keptFor", Assert.throws(() => KeptRuntime.fromJson({ keptFor: 0 }), JsonException).path);
    Assert.areEqual("$.keptFor", Assert.throws(() => KeptRuntime.fromJson({}), JsonException).path);
    Assert.areEqual("$.clients", Assert.throws(() => KeptRuntime.fromJson({ keptFor: 1, clients: [] }), JsonException).path);
  }
}
