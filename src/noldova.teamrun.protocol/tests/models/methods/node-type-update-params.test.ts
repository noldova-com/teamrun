/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NodeType, NodeTypeUpdateParams } from "@noldova/teamrun.protocol";

@TestClass
export class NodeTypeUpdateParamsTests {
  @TestMethod
  public preservesItsFieldsAndKeepsWhatItOmits(): void {
    const json = new NodeTypeUpdateParams("o1", "n1", "Team", "groups", null).toJson();
    const renamed = NodeTypeUpdateParams.fromJson({ organizationId: "o1", typeId: "n1", name: "Squad" });
    const type = new NodeType("n1", "Department", "domain", "teal", "c", "u");

    Assert.areEqual(JSON.stringify(json), JSON.stringify(NodeTypeUpdateParams.fromJson(json).toJson()));
    Assert.areEqual('{"organizationId":"o1","typeId":"n1","name":"Squad"}', JSON.stringify(renamed.toJson()));
    Assert.areEqual('{"id":"n1","name":"Squad","icon":"domain","color":"teal","createdAt":"c","updatedAt":"v"}', JSON.stringify(renamed.applyTo(type, "v").toJson()));
    Assert.areEqual('{"id":"n1","name":"Team","icon":"groups","color":null,"createdAt":"c","updatedAt":"v"}',
      JSON.stringify(NodeTypeUpdateParams.fromJson(json).applyTo(type, "v").toJson()));
    Assert.areEqual("$.input.icon", Assert.throws(() => NodeTypeUpdateParams.fromJson({ ...json, icon: "No" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.typeId", Assert.throws(() => NodeTypeUpdateParams.fromJson({ organizationId: "o1", name: "Team" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new NodeTypeUpdateParams(" ", "n1", "Team", undefined, undefined), ArgumentException).parameterName);
    Assert.areEqual("typeId", Assert.throws(() => new NodeTypeUpdateParams("o1", " ", "Team", undefined, undefined), ArgumentException).parameterName);
    Assert.areEqual("typeId", Assert.throws(() => new NodeTypeUpdateParams("o1", "n1", undefined, undefined, undefined), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new NodeTypeUpdateParams("o1", "n1", " ", undefined, undefined), ArgumentException).parameterName);
    Assert.areEqual("icon", Assert.throws(() => new NodeTypeUpdateParams("o1", "n1", undefined, "No", undefined), ArgumentException).parameterName);
    Assert.areEqual("color", Assert.throws(() => new NodeTypeUpdateParams("o1", "n1", undefined, undefined, "#FFF"), ArgumentException).parameterName);
    Assert.areEqual("teal", new NodeTypeUpdateParams("o1", "n1", undefined, undefined, "teal").color);
  }
}
