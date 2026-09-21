/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppServerClientInfo } from "@noldova/teamrun-providers";

@TestClass
export class AppServerClientInfoTests {
  @TestMethod
  public serializesAndValidates(): void {
    const info = new AppServerClientInfo("teamrun", "TeamRun", "1.0.0");

    Assert.areEqual("{\"name\":\"teamrun\",\"title\":\"TeamRun\",\"version\":\"1.0.0\"}", JSON.stringify(info.toJson()));
    Assert.areEqual("name", Assert.throws(() => new AppServerClientInfo("", "T", "1"), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new AppServerClientInfo("n", " ", "1"), ArgumentException).parameterName);
    Assert.areEqual("version", Assert.throws(() => new AppServerClientInfo("n", "T", ""), ArgumentException).parameterName);
  }
}
