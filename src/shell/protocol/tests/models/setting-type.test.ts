/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SettingKind, SettingOption, SettingType } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingTypeTests {
  private static readonly MODES: SettingType = SettingType.choice([new SettingOption("Light", "Light"), new SettingOption("Dark", "Dark")]);

  @TestMethod
  public pinsTheWireFormOfEachKind(): void {
    const types = [SettingType.boolean(), SettingTypeTests.MODES, SettingType.number(12, 18, 1), SettingType.text(200), SettingType.modules()];
    const texts = types.map(t => JSON.stringify(t.toJson()));

    Assert.areEqual(JSON.stringify([
      "{\"kind\":\"Boolean\"}",
      "{\"kind\":\"Choice\",\"options\":[{\"value\":\"Light\",\"title\":\"Light\"},{\"value\":\"Dark\",\"title\":\"Dark\"}]}",
      "{\"kind\":\"Number\",\"minimum\":12,\"maximum\":18,\"step\":1}",
      "{\"kind\":\"Text\",\"maxLength\":200}",
      "{\"kind\":\"Modules\"}"
    ]), JSON.stringify(texts));
    Assert.areEqual(JSON.stringify(texts), JSON.stringify(texts.map(t => JSON.stringify(SettingType.fromJson(JSON.parse(t)).toJson()))));
    Assert.areEqual("Choice,Number", [SettingTypeTests.MODES.kind, types[2]?.kind].join(","));
    Assert.areEqual("12,18,1,200", [types[2]?.minimum, types[2]?.maximum, types[2]?.step, types[3]?.maxLength].join(","));
    Assert.areEqual("Light,Dark", SettingTypeTests.MODES.options.map(t => t.value).join(","));
  }

  @TestMethod
  public acceptsOnlyTheValuesOfItsKind(): void {
    const cases: readonly (readonly [SettingType, readonly JsonValue[], readonly JsonValue[]])[] = [
      [SettingType.boolean(), [true, false], [1, "true", null]],
      [SettingTypeTests.MODES, ["Light", "Dark"], ["System", 1, null]],
      [SettingType.number(12, 18, 0.5), [12, 12.5, 18], [11.5, 18.5, 12.25, "12", null]],
      [SettingType.text(3), ["", "abc"], ["abcd", 3, null]],
      [SettingType.modules(), [[], ["notes", "clock"]], [["notes", "notes"], ["  "], [1], "notes", null]]
    ];

    for (const [type, accepted, refused] of cases) {
      Assert.isTrue(accepted.every(t => type.accepts(t)), `${type.kind} accepts ${JSON.stringify(accepted)}`);
      Assert.isTrue(refused.every(t => !type.accepts(t)), `${type.kind} refuses ${JSON.stringify(refused)}`);
    }
  }

  @TestMethod
  public refusesLimitsThatMakeNoType(): void {
    Assert.throws(() => SettingType.choice([]), ArgumentException);
    Assert.throws(() => SettingType.choice([new SettingOption("Dark", "Dark"), new SettingOption("Dark", "Dim")]), ArgumentException);
    Assert.throws(() => SettingType.number(18, 12, 1), ArgumentException);
    Assert.throws(() => SettingType.number(12, 18, 0), ArgumentException);
    Assert.throws(() => SettingType.number(Number.NaN, 18, 1), ArgumentException);
    Assert.throws(() => SettingType.text(0), ArgumentException);
    Assert.throws(() => SettingType.text(1.5), ArgumentException);
    Assert.areEqual(SettingKind.Text, SettingType.text(1).kind);
  }

  @TestMethod
  @TestData("{\"kind\":\"Color\"}", "$.kind")
  @TestData("{\"kind\":\"Boolean\",\"options\":[]}", "$.options")
  @TestData("{\"kind\":\"Text\",\"maxLength\":200,\"minimum\":1}", "$.minimum")
  @TestData("{\"kind\":\"Choice\",\"options\":[]}", "$.options")
  @TestData("{\"kind\":\"Choice\",\"options\":[{\"value\":\"\",\"title\":\"Blank\"}]}", "$.options.0.value")
  @TestData("{\"kind\":\"Number\",\"minimum\":18,\"maximum\":12,\"step\":1}", "$.minimum")
  @TestData("{\"kind\":\"Text\",\"maxLength\":-1}", "$.maxLength")
  public rejectsAWireTypeThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingType.fromJson(JSON.parse(text)), JsonException).path);
  }
}
