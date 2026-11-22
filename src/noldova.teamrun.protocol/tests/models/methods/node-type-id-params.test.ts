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
import { NodeTypeIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class NodeTypeIdParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new NodeTypeIdParams("o1", "n1").toJson();

    Assert.areEqual('{"organizationId":"o1","typeId":"n1"}', JSON.stringify(NodeTypeIdParams.fromJson(json).toJson()));
    Assert.areEqual("$.input.typeId", Assert.throws(() => NodeTypeIdParams.fromJson({ organizationId: "o1" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new NodeTypeIdParams(" ", "n1"), ArgumentException).parameterName);
    Assert.areEqual("typeId", Assert.throws(() => new NodeTypeIdParams("o1", " "), ArgumentException).parameterName);
  }
}
