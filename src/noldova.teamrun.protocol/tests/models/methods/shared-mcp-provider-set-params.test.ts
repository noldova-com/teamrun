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
import { SharedMcpProviderSetParams } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpProviderSetParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new SharedMcpProviderSetParams("s1", "p1", true).toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpProviderSetParams.fromJson(json).toJson()));
    Assert.areEqual("$.p.on", Assert.throws(() => SharedMcpProviderSetParams.fromJson({ ...json, on: "yes" }, "$.p"), JsonException).path);
    Assert.throws(() => new SharedMcpProviderSetParams(" ", "p1", true), ArgumentException);
    Assert.throws(() => new SharedMcpProviderSetParams("s1", " ", false), ArgumentException);
  }
}
