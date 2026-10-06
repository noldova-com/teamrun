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
import { UpdateRequest } from "@noldova/teamrun-shell-protocol";

@TestClass
export class UpdateRequestTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"installation\":\"/home/person/.local/state/noldova/teamrun/installations/0123456789abcdef\"}";

    Assert.areEqual(text, JSON.stringify(new UpdateRequest("/home/person/.local/state/noldova/teamrun/installations/0123456789abcdef").toJson()));
    Assert.areEqual(text, JSON.stringify(UpdateRequest.fromJson(JSON.parse(text)).toJson()));
  }

  @TestMethod
  public rejectsABlankInstallationOrAnUnknownField(): void {
    Assert.throws(() => new UpdateRequest(" "), ArgumentException);
    Assert.areEqual("$.installation", Assert.throws(() => UpdateRequest.fromJson({ installation: "" }), JsonException).path);
    Assert.areEqual("$.version", Assert.throws(() => UpdateRequest.fromJson({ installation: "i", version: "1" }), JsonException).path);
  }
}
