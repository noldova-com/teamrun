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
import { BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";

@TestClass
export class RuntimeHandoverTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const handover = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "def"), "C:\\Program Files\\TeamRun\\TeamRun.exe");
    const text = "{\"identity\":{\"productVersion\":\"0.0.2\",\"protocolVersion\":1,\"fingerprint\":\"def\"},\"executablePath\":\"C:\\\\Program Files\\\\TeamRun\\\\TeamRun.exe\"}";

    Assert.areEqual(text, JSON.stringify(handover.toJson()));
    const read = RuntimeHandover.fromJson(JSON.parse(text));
    Assert.areEqual("def", read.identity.fingerprint);
    Assert.areEqual("C:\\Program Files\\TeamRun\\TeamRun.exe", read.executablePath);
  }

  @TestMethod
  public rejectsABlankPath(): void {
    Assert.throws(() => new RuntimeHandover(new BuildIdentity("0.0.2", 1, "def"), " "), ArgumentException);
    const identity = { productVersion: "0.0.2", protocolVersion: 1, fingerprint: "def" };
    Assert.areEqual("$.executablePath", Assert.throws(() => RuntimeHandover.fromJson({ identity, executablePath: "" }), JsonException).path);
    Assert.areEqual("$.identity.extra", Assert.throws(() => RuntimeHandover.fromJson({ identity: { ...identity, extra: 1 }, executablePath: "x" }), JsonException).path);
  }
}
