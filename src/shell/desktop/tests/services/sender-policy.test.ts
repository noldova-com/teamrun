/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SenderInfo, SenderPolicy } from "@noldova/teamrun-shell-desktop";

@TestClass
export class SenderPolicyTests {
  @TestMethod
  public needsTheWindowUrl(): void {
    Assert.throws(() => new SenderPolicy(" "), ArgumentException);
  }

  @TestMethod
  @TestData("file:///app/index.html", true)
  @TestData("file:///app/index.html#workspace", true)
  @TestData("file:///app/index.html?theme=dark", true)
  @TestData("file:///app/index.html.evil", false)
  @TestData("file:///app/other.html", false)
  @TestData("https://example.com/", false)
  public recognizesOnlyTheWindowPage(url: string, expected: boolean): void {
    Assert.areEqual(expected, new SenderPolicy("file:///app/index.html").isWindowUrl(url));
  }

  @TestMethod
  public trustsOnlyTheWindowsTopLevelFrame(): void {
    const policy = new SenderPolicy("file:///app/index.html");

    Assert.isTrue(policy.isTrusted(new SenderInfo("file:///app/index.html", true, 1)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("file:///app/index.html", false, 1)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("https://example.com/", true, 1)));
  }
}
