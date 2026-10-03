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
  public carriesItsStateWithTheDefaultsLeftOut(): void {
    const name = QualifiedName.parse("clock.pause");
    const disabled = "{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isEnabled\":false,\"isChecked\":true}";
    const unchecked = "{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":false}";
    const bare = new CommandInfo(name, "Pause", null, null);
    const read = CommandInfo.fromJson(JSON.parse(disabled));

    Assert.areEqual(disabled, JSON.stringify(new CommandInfo(name, "Pause", null, null, false, true).toJson()));
    Assert.areEqual(unchecked, JSON.stringify(new CommandInfo(name, "Pause", null, null, true, false).toJson()));
    Assert.isTrue(bare.isEnabled);
    Assert.isNull(bare.isChecked);
    Assert.areEqual("false,true", [read.isEnabled, read.isChecked].join(","));
    Assert.areEqual(unchecked, JSON.stringify(CommandInfo.fromJson({ name: "clock.pause", title: "Pause", isEnabled: true, isChecked: false }).toJson()));
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
    Assert.areEqual("$.isEnabled", Assert.throws(() => CommandInfo.fromJson({ name: "clock.tick", title: "Tick", isEnabled: "no" }), JsonException).path);
    Assert.areEqual("$.isChecked", Assert.throws(() => CommandInfo.fromJson({ name: "clock.tick", title: "Tick", isChecked: null }), JsonException).path);
  }
}
