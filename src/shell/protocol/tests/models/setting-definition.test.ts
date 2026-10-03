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
import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";

@TestClass
export class SettingDefinitionTests {
  private static readonly NAME: QualifiedName = QualifiedName.parse("chat.sendWithEnter");
  private static readonly CONVERSATION: QualifiedName = QualifiedName.parse("chat.conversation");
  private static readonly TEXT: string =
    "{\"name\":\"chat.sendWithEnter\",\"title\":\"Send with Enter\",\"description\":\"Sends a message when Enter is pressed.\",\"type\":{\"kind\":\"Boolean\"}," +
    "\"default\":true,\"locality\":\"Shared\",\"scopes\":[\"chat.conversation\"],\"page\":\"Chat\",\"group\":\"Composer\"}";

  @TestMethod
  public pinsItsWireForm(): void {
    const definition = SettingDefinition.fromJson(JSON.parse(SettingDefinitionTests.TEXT));

    Assert.areEqual(SettingDefinitionTests.TEXT, JSON.stringify(SettingDefinitionTests.create().toJson()));
    Assert.areEqual(SettingDefinitionTests.TEXT, JSON.stringify(definition.toJson()));
    Assert.areEqual("chat.sendWithEnter|Send with Enter|true|Shared|Chat|Composer", [
      definition.name.text, definition.title, definition.defaultValue, definition.locality, definition.page, definition.group
    ].join("|"));
    Assert.areEqual("Sends a message when Enter is pressed.", definition.description);
    Assert.areEqual("Boolean", definition.type.kind);
  }

  @TestMethod
  public tellsTheScopesThatMayOverrideIt(): void {
    const definition = SettingDefinitionTests.create();

    Assert.isTrue(definition.isScopedBy(QualifiedName.parse("chat.conversation")));
    Assert.isFalse(definition.isScopedBy(QualifiedName.parse("projects.project")));
    Assert.areEqual("chat.conversation", definition.scopes.map(t => t.text).join(","));
  }

  @TestMethod
  public namesWhatMakesItInvalid(): void {
    const create = (change: (values: unknown[]) => void): ArgumentException => {
      const values: unknown[] = [SettingDefinitionTests.NAME, "Send", "Sends.", SettingType.boolean(), true, SettingLocality.Shared, [], "Chat", "Composer"];
      change(values);
      return Assert.throws(() => Reflect.construct(SettingDefinition, values), ArgumentException);
    };

    Assert.areEqual("title,description,page,group,default,scopes,scopes", [
      create(t => t[1] = " ").parameterName,
      create(t => t[2] = "").parameterName,
      create(t => t[7] = "").parameterName,
      create(t => t[8] = " ").parameterName,
      create(t => t[4] = "yes").parameterName,
      create(t => t[6] = [SettingDefinitionTests.CONVERSATION, QualifiedName.parse("chat.conversation")]).parameterName,
      create(t => {
        t[5] = SettingLocality.Device;
        t[6] = [SettingDefinitionTests.CONVERSATION];
      }).parameterName
    ].join(","));
  }

  @TestMethod
  @TestData("type", "{\"kind\":\"Color\"}", "$.type.kind")
  @TestData("default", "\"yes\"", "$.default")
  @TestData("locality", "\"Everywhere\"", "$.locality")
  @TestData("scopes", "[\"conversation\"]", "$.scopes")
  @TestData("extra", "1", "$.extra")
  public rejectsAWireDefinitionThatIsNotOne(field: string, value: string, path: string): void {
    const json = { ...JSON.parse(SettingDefinitionTests.TEXT), [field]: JSON.parse(value) };

    Assert.areEqual(path, Assert.throws(() => SettingDefinition.fromJson(json), JsonException).path);
  }

  private static create(): SettingDefinition {
    return new SettingDefinition(SettingDefinitionTests.NAME, "Send with Enter", "Sends a message when Enter is pressed.", SettingType.boolean(), true,
      SettingLocality.Shared, [SettingDefinitionTests.CONVERSATION], "Chat", "Composer");
  }
}
