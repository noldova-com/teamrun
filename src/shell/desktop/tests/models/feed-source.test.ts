/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FeedSource, type IFeedResponse } from "@noldova/teamrun-shell-desktop";

@TestClass
export class FeedSourceTests {
  private static readonly FEED: string = "https://example.test/releases/latest/download/";

  @TestMethod
  public namesTheFilesOfEachPlatformAndProcessor(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));
    const files = [["win32", "x64"], ["darwin", "arm64"], ["linux", "x64"], ["linux", "arm64"]].map(([platform, architecture]) => {
      const source = FeedSource.create(FeedSourceTests.FEED, "TeamRun", String(platform), String(architecture), fetchAsync);
      return [source?.feed, source?.channelFile, source?.packageFile, source?.fetchAsync === fetchAsync, source?.timeout];
    });

    Assert.areEqual(JSON.stringify([
      [FeedSourceTests.FEED, "latest-windows-x64.yml", "TeamRun-windows-x64.exe", true, 30000],
      [FeedSourceTests.FEED, "latest-macos-arm64.yml", "TeamRun-macos-arm64.zip", true, 30000],
      [FeedSourceTests.FEED, "latest-linux-x64.yml", "TeamRun-linux-x64.AppImage", true, 30000],
      [FeedSourceTests.FEED, "latest-linux-arm64.yml", "TeamRun-linux-arm64.AppImage", true, 30000]
    ]), JSON.stringify(files));
  }

  @TestMethod
  public hasNoSourceWithoutAFeedOrForATargetWithoutPackages(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));

    Assert.isNull(FeedSource.create(null, "TeamRun", "linux", "x64", fetchAsync));
    Assert.isNull(FeedSource.create(FeedSourceTests.FEED, "TeamRun", "freebsd", "x64", fetchAsync));
    Assert.isNull(FeedSource.create(FeedSourceTests.FEED, "TeamRun", "linux", "ia32", fetchAsync));
  }
}
