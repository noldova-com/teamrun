/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, UpdateSettings } from "@noldova/teamrun-desktop";

@TestClass
export class UpdateSettingsTests {
  @TestMethod
  public defaultsPackagedWindowsX64ToThePublicReleaseFeedWithoutCredentials(): void {
    for (const environment of [{}, { TEAMRUN_UPDATE_TEST_FEED: " " }]) {
      const settings = UpdateSettings.fromEnvironment(environment, true, "win32", "x64");
      Assert.areEqual("https://github.com/noldova-com/teamrun/releases/latest/download/", settings.feedUrl);
      Assert.isTrue(settings.allowInstallation);
      Assert.isFalse(settings.isTestFeed);
      Assert.isNull(settings.disabledReason);
    }
    for (const [platform, architecture] of [["win32", "arm64"], ["linux", "x64"], ["darwin", "arm64"]] as const) {
      const settings = UpdateSettings.fromEnvironment({}, true, platform, architecture);
      Assert.isNull(settings.feedUrl);
      Assert.isNull(settings.disabledReason);
      Assert.isFalse(settings.allowInstallation);
    }
  }

  @TestMethod
  public permitsOnlyExplicitPackagedLoopbackFeedsAndSeparatesCpuTargets(): void {
    const environment = { TEAMRUN_UPDATE_TEST_FEED: "http://127.0.0.1:8000/test///" };
    Assert.areEqual("http://127.0.0.1:8000/test/windows-x64/", UpdateSettings.fromEnvironment(environment, true, "win32", "x64").feedUrl);
    Assert.areEqual("http://127.0.0.1:8000/test/windows-arm64/", UpdateSettings.fromEnvironment(environment, true, "win32", "arm64").feedUrl);
    for (const host of ["localhost", "[::1]"])
      Assert.isNotNull(UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: `http://${host}:8000` }, true, "win32", "x64").feedUrl);
    Assert.areEqual(Resources.updatesDevelopmentDisabled, UpdateSettings.fromEnvironment(environment, false, "win32", "x64").disabledReason);
    Assert.isTrue(UpdateSettings.fromEnvironment(environment, true, "win32", "x64").isTestFeed);
    Assert.isFalse(UpdateSettings.fromEnvironment(environment, true, "win32", "x64").allowInstallation);
    for (const [platform, architecture] of [["linux", "x64"], ["win32", "ia32"]] as const) {
      const settings = UpdateSettings.fromEnvironment(environment, true, platform, architecture);
      Assert.isNull(settings.feedUrl);
      Assert.isNull(settings.disabledReason);
    }
  }

  @TestMethod
  public rejectsUntrustedFeedAddresses(): void {
    for (const value of ["bad url", "https://localhost/", "http://example.com/", "file:///tmp/feed", "http://localhost.evil/",
      "http://localhost/?secret=value", "http://localhost/#fragment", "http://user@localhost/", "http://:secret@localhost/"])
      Assert.areEqual(Resources.updatesFeedInvalid, UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: value }, true, "win32", "x64").disabledReason);
  }

  @TestMethod
  public excludesPreviewVersionsWithoutMistakingBuildMetadataForAPrerelease(): void {
    Assert.isTrue(Resources.updatePrereleasePattern.test("1.0.0-beta.1"));
    Assert.isTrue(Resources.updatePrereleasePattern.test("1.0.0-beta.1+build"));
    Assert.isFalse(Resources.updatePrereleasePattern.test("1.0.0"));
    Assert.isFalse(Resources.updatePrereleasePattern.test("1.0.0+build-with-dashes"));
  }
}
