/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopInfo } from "@noldova/teamrun-desktop";

@TestClass
export class DesktopInfoTests {
  @TestMethod
  public rendersItsJson(): void {
    const info = new DesktopInfo("D:\\data", "1.2.3", "win32");

    Assert.areEqual("{\"dataDirectory\":\"D:\\\\data\",\"productVersion\":\"1.2.3\",\"platform\":\"win32\"}", JSON.stringify(info.toJson()));
  }

  @TestMethod
  public rejectsBlankValues(): void {
    Assert.areEqual("dataDirectory", Assert.throws(() => new DesktopInfo(" ", "1", "win32"), ArgumentException).parameterName);
    Assert.areEqual("productVersion", Assert.throws(() => new DesktopInfo("D:\\data", "", "win32"), ArgumentException).parameterName);
    Assert.areEqual("platform", Assert.throws(() => new DesktopInfo("D:\\data", "1", ""), ArgumentException).parameterName);
  }
}
