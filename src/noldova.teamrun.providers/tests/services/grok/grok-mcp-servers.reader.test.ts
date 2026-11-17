/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { JsonException } from "@noldova/context.json";
import { GrokMcpServersReader } from "@noldova/teamrun.providers";

@TestClass
export class GrokMcpServersReaderTests {
  @TestMethod
  @TestData("{}")
  @TestData("{\"servers\":null}")
  @TestData("{\"servers\":[]}")
  @TestData("{\"servers\":[{\"name\":\"teamrun\"}]}")
  public readsNoServerFromAnAnswerWithNoServersFieldANullOneAnEmptyListOrOnlyTeamRunsOwn(answer: string): void {
    Assert.areEqual(0, new GrokMcpServersReader().read(JSON.parse(answer)).length);
  }

  @TestMethod
  @TestData("null", "$")
  @TestData("[]", "$")
  @TestData("\"x\"", "$")
  @TestData("{\"servers\":\"docs\"}", "$.servers")
  @TestData("{\"servers\":[{\"source\":\"local\"}]}", "$.servers.0.name")
  @TestData("{\"servers\":[{\"name\":\" \"}]}", "$.servers.0.name")
  public failsAtThePathOfAnAnswerThatIsntAnObjectAServersFieldThatIsntAListOrAServerWithNoName(answer: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => new GrokMcpServersReader().read(JSON.parse(answer)), JsonException).path);
  }
}
