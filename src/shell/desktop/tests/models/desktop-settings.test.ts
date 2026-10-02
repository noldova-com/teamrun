/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopSettings } from "@noldova/teamrun-shell-desktop";

@TestClass
export class DesktopSettingsTests {
  @TestMethod
  public findsTheBuiltWindowAndThePreloadFromTheInstalledPackage(): void {
    const module = resolve("repository", "node_modules", "@noldova", "teamrun-shell-desktop");
    const settings = DesktopSettings.fromModule(module, "linux");

    Assert.areEqual("linux", settings.platform);
    Assert.areEqual(resolve("repository", "_build", "window", "browser", "index.html"), settings.windowIndexPath);
    Assert.areEqual(join(module, "preload.cjs"), settings.preloadPath);
    Assert.areEqual(pathToFileURL(settings.windowIndexPath).href, settings.windowUrl);
  }

  @TestMethod
  @TestData("darwin", true)
  @TestData("win32", false)
  @TestData("linux", false)
  public knowsWhetherItRunsOnMacOS(platform: string, expected: boolean): void {
    Assert.areEqual(expected, new DesktopSettings(platform, "index.html", "preload.cjs").isMac);
  }

  @TestMethod
  @TestData(" ", "index.html", "preload.cjs")
  @TestData("linux", "", "preload.cjs")
  @TestData("linux", "index.html", " ")
  public needsEveryValue(platform: string, windowIndexPath: string, preloadPath: string): void {
    Assert.throws(() => new DesktopSettings(platform, windowIndexPath, preloadPath), ArgumentException);
  }
}
