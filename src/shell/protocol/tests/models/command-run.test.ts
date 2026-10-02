/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class CommandRunTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"clock.tick\",\"arguments\":{\"by\":2}}";

    const run = CommandRun.fromJson(JSON.parse(text));

    Assert.areEqual("clock.tick", run.name.text);
    Assert.areEqual(text, JSON.stringify(run.toJson()));
    Assert.areEqual("{\"name\":\"clock.tick\",\"arguments\":null}", JSON.stringify(new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
  }

  @TestMethod
  public refusesUnknownFieldsAndMissingOnes(): void {
    Assert.areEqual("$.extra", Assert.throws(() => CommandRun.fromJson({ name: "clock.tick", arguments: null, extra: 1 }), JsonException).path);
    Assert.areEqual("$.arguments", Assert.throws(() => CommandRun.fromJson({ name: "clock.tick" }), JsonException).path);
    Assert.areEqual("$.name", Assert.throws(() => CommandRun.fromJson({ name: "tick", arguments: null }), JsonException).path);
  }
}
