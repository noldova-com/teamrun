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
import { SharedMcpSetting, SharedMcpTeammateSetParams } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpTeammateSetParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    for (const setting of Object.values(SharedMcpSetting)) {
      const json = new SharedMcpTeammateSetParams("s1", "t1", setting).toJson();
      Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpTeammateSetParams.fromJson(json).toJson()));
    }
    Assert.areEqual("$.p.setting", Assert.throws(() => SharedMcpTeammateSetParams.fromJson({ serverId: "s1", teammateId: "t1", setting: "on" }, "$.p"),
      JsonException).path);
    Assert.throws(() => new SharedMcpTeammateSetParams(" ", "t1", SharedMcpSetting.On), ArgumentException);
    Assert.throws(() => new SharedMcpTeammateSetParams("s1", " ", SharedMcpSetting.On), ArgumentException);
    Assert.areEqual("setting", Assert.throws(() => new SharedMcpTeammateSetParams("s1", "t1", "Sometimes" as SharedMcpSetting), ArgumentException).parameterName);
  }
}
