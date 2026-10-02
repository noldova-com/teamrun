/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandInfo, KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class CommandInfoTests {
  @TestMethod
  public pinsItsWireFormWithOptionalFieldsOnlyWhenPresent(): void {
    const full = "{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"}";
    const bare = "{\"name\":\"clock.tick\",\"title\":\"Tick\"}";

    Assert.areEqual(full, JSON.stringify(new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", "timer", KeyChord.parseDefault("Alt+Mod+T")).toJson()));
    Assert.areEqual(bare, JSON.stringify(new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", null, null).toJson()));
    Assert.areEqual(full, JSON.stringify(CommandInfo.fromJson(JSON.parse(full)).toJson()));
    Assert.areEqual(bare, JSON.stringify(CommandInfo.fromJson({ ...JSON.parse(bare), group: "later" }).toJson()));
  }

  @TestMethod
  public refusesABlankTitleOrIcon(): void {
    Assert.areEqual("title", Assert.throws(() => new CommandInfo(QualifiedName.parse("clock.tick"), " ", null, null), ArgumentException).parameterName);
    Assert.areEqual("icon", Assert.throws(() => new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", "", null), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheFieldThatIsInvalid(): void {
    Assert.areEqual("$.name", Assert.throws(() => CommandInfo.fromJson({ name: "tick", title: "Tick" }), JsonException).path);
    Assert.areEqual("$.title", Assert.throws(() => CommandInfo.fromJson({ name: "clock.tick", title: "" }), JsonException).path);
    Assert.areEqual("$.defaultKey", Assert.throws(() => CommandInfo.fromJson({ name: "clock.tick", title: "Tick", defaultKey: "Mod+C" }), JsonException).path);
  }
}
