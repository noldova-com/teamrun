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
import { NodeTypeCreateParams } from "@noldova/teamrun.protocol";

@TestClass
export class NodeTypeCreateParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new NodeTypeCreateParams("o1", "Team", "groups", "teal").toJson();
    const plain = NodeTypeCreateParams.fromJson({ organizationId: "o1", name: "Squad" });

    Assert.areEqual(JSON.stringify(json), JSON.stringify(NodeTypeCreateParams.fromJson(json).toJson()));
    Assert.areEqual('{"organizationId":"o1","name":"Squad","icon":null,"color":null}', JSON.stringify(plain.toJson()));
    Assert.areEqual("$.input.name", Assert.throws(() => NodeTypeCreateParams.fromJson({ ...json, name: "" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.icon", Assert.throws(() => NodeTypeCreateParams.fromJson({ ...json, icon: "No" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.color", Assert.throws(() => NodeTypeCreateParams.fromJson({ ...json, color: "#FFF" }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.organizationId", Assert.throws(() => NodeTypeCreateParams.fromJson({ name: "Team" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new NodeTypeCreateParams(" ", "Team"), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new NodeTypeCreateParams("o1", " "), ArgumentException).parameterName);
    Assert.areEqual("icon", Assert.throws(() => new NodeTypeCreateParams("o1", "Team", "No"), ArgumentException).parameterName);
    Assert.areEqual("color", Assert.throws(() => new NodeTypeCreateParams("o1", "Team", null, "#FFF"), ArgumentException).parameterName);
  }
}
