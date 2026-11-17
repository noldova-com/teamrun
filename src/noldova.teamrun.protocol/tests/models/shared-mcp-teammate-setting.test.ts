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
import { SharedMcpSetting, SharedMcpTeammateSetting } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpTeammateSettingTests {
  @TestMethod
  public keepsATeammatesOnOrOff(): void {
    for (const setting of ["On", "Off"]) {
      const json = { teammateId: "t1", setting };
      Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpTeammateSetting.fromJson(json).toJson()));
    }
    Assert.areEqual("$.s.setting", Assert.throws(() => SharedMcpTeammateSetting.fromJson({ teammateId: "t1", setting: "Maybe" }, "$.s"), JsonException).path);
  }

  @TestMethod
  public refusesABlankTeammateAndAsItsProviderWhichIsKeptAsNoSetting(): void {
    Assert.throws(() => new SharedMcpTeammateSetting(" ", SharedMcpSetting.On), ArgumentException);
    Assert.areEqual("setting", Assert.throws(() => new SharedMcpTeammateSetting("t1", SharedMcpSetting.AsProvider), ArgumentException).parameterName);
  }
}
