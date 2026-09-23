/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopSettings, SenderInfo, SenderPolicy } from "@noldova/teamrun-desktop";

@TestClass
export class SenderPolicyTests {
  private static readonly index: string = resolve("renderer", "index.html");
  private static readonly indexUrl: string = pathToFileURL(SenderPolicyTests.index).href;

  @TestMethod
  public trustsOnlyTheBuiltRendererPage(): void {
    const policy = new SenderPolicy(new DesktopSettings(resolve("data"), "1", SenderPolicyTests.index, resolve("icon.png"), null, null, 1));

    Assert.isTrue(policy.isTrusted(new SenderInfo(SenderPolicyTests.indexUrl, true)));
    Assert.isTrue(policy.isTrusted(new SenderInfo(`${SenderPolicyTests.indexUrl}#/conversations/1`, true)));
    Assert.isTrue(policy.isTrusted(new SenderInfo(`${SenderPolicyTests.indexUrl}?debug`, true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo(SenderPolicyTests.indexUrl, false)));
    Assert.isFalse(policy.isTrusted(new SenderInfo(`${SenderPolicyTests.indexUrl}.evil`, true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo(pathToFileURL(resolve("renderer", "other.html")).href, true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("https://example.com/", true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("", true)));
  }

  @TestMethod
  public trustsAnyTopLevelPageOfTheDevelopmentServer(): void {
    const policy = new SenderPolicy(new DesktopSettings(resolve("data"), "1", SenderPolicyTests.index, resolve("icon.png"), "http://localhost:4200", null, 1));

    Assert.isTrue(policy.isTrusted(new SenderInfo("http://localhost:4200/", true)));
    Assert.isTrue(policy.isTrusted(new SenderInfo("http://localhost:4200/conversations/1", true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("http://localhost:4200/", false)));
    Assert.isFalse(policy.isTrusted(new SenderInfo("http://localhost:4201/", true)));
    Assert.isFalse(policy.isTrusted(new SenderInfo(SenderPolicyTests.indexUrl, true)));
  }

  @TestMethod
  public rejectsDevelopmentOriginLookalikesAndMalformedUrls(): void {
    const policy = new SenderPolicy(new DesktopSettings(resolve("data"), "1", SenderPolicyTests.index, resolve("icon.png"), "http://localhost:4200", null, 1));

    for (const url of ["http://localhost:42000/", "http://localhost:4200@example.com/", "http://localhost:4200.evil/",
      "https://localhost:4200/", "blob:http://localhost:4200/id", "not a URL", ""])
      Assert.isFalse(policy.isTrusted(new SenderInfo(url, true)));

    const defaultPort = new SenderPolicy(new DesktopSettings(resolve("data"), "1", SenderPolicyTests.index, resolve("icon.png"), "http://localhost", null, 1));
    Assert.isFalse(defaultPort.isTrusted(new SenderInfo("http://localhost.evil/", true)));
    Assert.isTrue(defaultPort.isTrusted(new SenderInfo("http://localhost:80/conversations/1", true)));
  }

  @TestMethod
  public permitsOnlyClipboardWritesFromTheTrustedTopLevelPage(): void {
    const policy = new SenderPolicy(new DesktopSettings(resolve("data"), "1", SenderPolicyTests.index, resolve("icon.png"), null, null, 1));
    const sender = new SenderInfo(SenderPolicyTests.indexUrl, true);

    Assert.isTrue(policy.allowsPermission(sender, "clipboard-sanitized-write"));
    for (const permission of ["clipboard-read", "notifications", "media", "unknown"])
      Assert.isFalse(policy.allowsPermission(sender, permission));
    Assert.isFalse(policy.allowsPermission(new SenderInfo(SenderPolicyTests.indexUrl, false), "clipboard-sanitized-write"));
    Assert.isFalse(policy.allowsPermission(new SenderInfo("https://example.com/", true), "clipboard-sanitized-write"));
  }
}
