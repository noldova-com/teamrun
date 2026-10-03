/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, SettingKey, SettingScope } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingKeyTests {
  @TestMethod
  public pinsItsWireFormWithAndWithoutAScopeAndADevice(): void {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c42");
    const keys = [
      new SettingKey(QualifiedName.parse("shell.mode")),
      new SettingKey(QualifiedName.parse("chat.sendWithEnter"), scope),
      new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1")
    ];
    const texts = keys.map(t => JSON.stringify(t.toJson()));

    Assert.areEqual(JSON.stringify([
      "{\"name\":\"shell.mode\"}",
      "{\"name\":\"chat.sendWithEnter\",\"scope\":{\"name\":\"chat.conversation\",\"id\":\"c42\"}}",
      "{\"name\":\"shell.doNotDisturb\",\"device\":\"d1\"}"
    ]), JSON.stringify(texts));
    Assert.areEqual(JSON.stringify(texts), JSON.stringify(texts.map(t => JSON.stringify(SettingKey.fromJson(JSON.parse(t)).toJson()))));
    Assert.isNull(keys[0]?.scope);
    Assert.areEqual("c42,d1", [keys[1]?.scope?.id, keys[2]?.device].join(","));
  }

  @TestMethod
  public refusesABlankDevice(): void {
    Assert.areEqual("device", Assert.throws(() => new SettingKey(QualifiedName.parse("shell.mode"), null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("{\"name\":\"mode\"}", "$.name")
  @TestData("{\"name\":\"shell.mode\",\"device\":\"\"}", "$.device")
  @TestData("{\"name\":\"shell.mode\",\"scope\":{\"name\":\"chat.conversation\",\"id\":\"\"}}", "$.scope.id")
  @TestData("{\"name\":\"shell.mode\",\"value\":\"Dark\"}", "$.value")
  public rejectsAWireKeyThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingKey.fromJson(JSON.parse(text)), JsonException).path);
  }
}
