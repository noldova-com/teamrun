/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { NodeType } from "@noldova/teamrun.protocol";

@TestClass
export class NodeTypeTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const value = new NodeType("n1", "Team", "groups", "#1a2b3c", "c", "u");
    const json = value.toJson();
    const plain = NodeType.fromJson(new NodeType("n2", "Squad", null, "teal", "c", "u").toJson());

    Assert.areEqual(JSON.stringify(json), JSON.stringify(NodeType.fromJson(json).toJson()));
    Assert.areEqual("n1,Team,groups,#1a2b3c,c,u", [value.id, value.name, value.icon, value.color, value.createdAt, value.updatedAt].join(","));
    Assert.areEqual(JSON.stringify(["Squad", null, "teal"]), JSON.stringify([plain.name, plain.icon, plain.color]));
    Assert.areEqual("$.input.name", Assert.throws(() => NodeType.fromJson({ ...json, name: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.icon", Assert.throws(() => NodeType.fromJson({ ...json, icon: "Groups" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.color", Assert.throws(() => NodeType.fromJson({ ...json, color: "#ABCDEF" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.id", Assert.throws(() => NodeType.fromJson({ ...json, id: "" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("id", Assert.throws(() => new NodeType(" ", "Team", null, null, "c", "u"), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new NodeType("n1", "x".repeat(101), null, null, "c", "u"), ArgumentException).parameterName);
    Assert.areEqual("icon", Assert.throws(() => new NodeType("n1", "Team", "a b", null, "c", "u"), ArgumentException).parameterName);
    Assert.areEqual("color", Assert.throws(() => new NodeType("n1", "Team", null, "#abc", "c", "u"), ArgumentException).parameterName);
    Assert.areEqual("createdAt", Assert.throws(() => new NodeType("n1", "Team", null, null, " ", "u"), ArgumentException).parameterName);
    Assert.areEqual("updatedAt", Assert.throws(() => new NodeType("n1", "Team", null, null, "c", " "), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("groups")
  @TestData("account_tree")
  @TestData("x".repeat(64))
  public takesAMaterialSymbolsIcon(icon: string): void {
    NodeType.validateIcon(icon);

    Assert.areEqual(icon, new NodeType("n1", "Team", icon, null, "c", "u").icon);
  }

  @TestMethod
  @TestData("")
  @TestData("Groups")
  @TestData("group-work")
  @TestData("x".repeat(65))
  public refusesAnIconThatIsNotAMaterialSymbolsName(icon: string): void {
    Assert.areEqual("icon", Assert.throws(() => NodeType.validateIcon(icon), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("#00ff7f")
  @TestData("teal")
  @TestData("accent-2")
  public takesAKitColorOrARgbColor(color: string): void {
    NodeType.validateColor(color);

    Assert.areEqual(color, new NodeType("n1", "Team", null, color, "c", "u").color);
  }

  @TestMethod
  @TestData("")
  @TestData("#00FF7F")
  @TestData("#0f7")
  @TestData("2nd")
  @TestData("Teal")
  public refusesAColorThatIsNeitherAKitColorNorARgbColor(color: string): void {
    Assert.areEqual("color", Assert.throws(() => NodeType.validateColor(color), ArgumentException).parameterName);
  }

  @TestMethod
  public takesNoIconAndNoColor(): void {
    NodeType.validateIcon(null);
    NodeType.validateColor(null);

    const bare = new NodeType("n1", "Team", null, null, "c", "u");
    Assert.isNull(bare.icon);
    Assert.isNull(bare.color);
  }
}
