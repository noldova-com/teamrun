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
import { SharedMcpServerDefinition, SharedMcpServerUpdateParams, SharedMcpTransport } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpServerUpdateParamsTests {
  private static readonly definition = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);

  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new SharedMcpServerUpdateParams("s1", SharedMcpServerUpdateParamsTests.definition).toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerUpdateParams.fromJson(json).toJson()));
    Assert.areEqual("$.p.definition.command", Assert.throws(() => SharedMcpServerUpdateParams.fromJson(
      { ...json, definition: { ...SharedMcpServerUpdateParamsTests.definition.toJson(), command: 1 } }, "$.p"), JsonException).path);
    Assert.throws(() => new SharedMcpServerUpdateParams(" ", SharedMcpServerUpdateParamsTests.definition), ArgumentException);
  }
}
