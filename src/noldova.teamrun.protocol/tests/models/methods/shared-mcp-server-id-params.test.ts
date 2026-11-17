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
import { SharedMcpServerIdParams } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpServerIdParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new SharedMcpServerIdParams("s1").toJson();

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerIdParams.fromJson(json).toJson()));
    Assert.areEqual("$.p.serverId", Assert.throws(() => SharedMcpServerIdParams.fromJson({ serverId: 1 }, "$.p"), JsonException).path);
    Assert.throws(() => new SharedMcpServerIdParams(" "), ArgumentException);
  }
}
