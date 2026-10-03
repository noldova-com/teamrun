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
import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingScopeTests {
  private static readonly CONVERSATION: QualifiedName = QualifiedName.parse("chat.conversation");

  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"chat.conversation\",\"id\":\"c42\"}";

    Assert.areEqual(text, JSON.stringify(new SettingScope(SettingScopeTests.CONVERSATION, "c42").toJson()));
    Assert.areEqual(text, JSON.stringify(SettingScope.fromJson(JSON.parse(text)).toJson()));
  }

  @TestMethod
  public equalsOnlyTheSameObjectOfTheSameScope(): void {
    const scope = new SettingScope(SettingScopeTests.CONVERSATION, "c42");

    Assert.isTrue(scope.equals(new SettingScope(QualifiedName.parse("chat.conversation"), "c42")));
    Assert.isFalse(scope.equals(new SettingScope(SettingScopeTests.CONVERSATION, "c43")));
    Assert.isFalse(scope.equals(new SettingScope(QualifiedName.parse("chat.thread"), "c42")));
    Assert.isFalse(scope.equals(null));
  }

  @TestMethod
  public refusesABlankId(): void {
    Assert.areEqual("id", Assert.throws(() => new SettingScope(SettingScopeTests.CONVERSATION, " "), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("{\"name\":\"conversation\",\"id\":\"c42\"}", "$.name")
  @TestData("{\"name\":\"chat.conversation\",\"id\":\"\"}", "$.id")
  @TestData("{\"name\":\"chat.conversation\",\"id\":\"c42\",\"parent\":null}", "$.parent")
  public rejectsAWireScopeThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingScope.fromJson(JSON.parse(text)), JsonException).path);
  }
}
