/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopSettings, Resources } from "@noldova/teamrun-desktop";

@TestClass
export class DesktopSettingsTests {
  private static readonly data: string = resolve("data");
  private static readonly index: string = resolve("renderer", "index.html");
  private static readonly icon: string = resolve("assets", "icons", "icon-dark-512.png");

  @TestMethod
  public describesTheBuiltRenderer(): void {
    const settings = new DesktopSettings(DesktopSettingsTests.data, "1.0.0", DesktopSettingsTests.index, DesktopSettingsTests.icon, null, null, 100);

    Assert.isFalse(settings.usesDevelopmentServer);
    Assert.areEqual(pathToFileURL(DesktopSettingsTests.index).href, settings.rendererOrigin);
    Assert.areEqual(Resources.productionContentSecurityPolicy, settings.contentSecurityPolicy);
    Assert.isNull(settings.screenshotPath);
    Assert.areEqual(100, settings.screenshotDelayMilliseconds);
  }

  @TestMethod
  public describesTheDevelopmentServer(): void {
    const settings =
      new DesktopSettings(DesktopSettingsTests.data, "1.0.0", DesktopSettingsTests.index, DesktopSettingsTests.icon, "http://localhost:4200/index.html", "shot.png", 5);

    Assert.isTrue(settings.usesDevelopmentServer);
    Assert.areEqual("http://localhost:4200", settings.rendererOrigin);
    Assert.areEqual(Resources.developmentContentSecurityPolicy, settings.contentSecurityPolicy);
    Assert.areEqual("shot.png", settings.screenshotPath);
  }

  @TestMethod
  public readsDefaultsFromTheEnvironment(): void {
    const settings = DesktopSettings.fromEnvironment({}, resolve("user"), resolve("module", "dist"), "2.0.0");

    Assert.areEqual(resolve("user", ".noldova", "teamrun"), settings.dataDirectory);
    Assert.areEqual("2.0.0", settings.productVersion);
    Assert.areEqual(resolve("module", "dist", "..", "..", "..", "_build", "renderer", "browser", "index.html"), settings.rendererIndexPath);
    Assert.areEqual(resolve("module", "dist", "..", "..", "..", "assets", "icons", "icon-dark-512.png"), settings.iconPath);
    Assert.isNull(settings.rendererUrl);
    Assert.isNull(settings.screenshotPath);
    Assert.areEqual(Resources.defaultScreenshotDelay, settings.screenshotDelayMilliseconds);
    Assert.isNull(settings.startView);
  }

  @TestMethod
  public keepsNativeIconsOutsideTheApplicationArchive(): void {
    const resourcesDirectory = resolve("packaged", "resources");
    const moduleDirectory = join(resourcesDirectory, "app.asar", "node_modules", "@noldova", "teamrun-desktop");
    const settings = DesktopSettings.fromEnvironment({}, resolve("user"), moduleDirectory, "2.0.0", resourcesDirectory);

    Assert.areEqual(join(resourcesDirectory, "assets", "icons", "icon-dark-512.png"), settings.iconPath);
    Assert.areEqual(join(resourcesDirectory, "app.asar", "_build", "renderer", "browser", "index.html"), settings.rendererIndexPath);
  }

  @TestMethod
  public readsOverridesFromTheEnvironment(): void {
    const environment = {
      [Resources.dataDirectoryVariable]: join("relative", "data"),
      [Resources.rendererIndexVariable]: "custom/index.html",
      [Resources.rendererUrlVariable]: "http://localhost:4200",
      [Resources.screenshotVariable]: "evidence.png",
      [Resources.screenshotDelayVariable]: "42",
      [Resources.startViewVariable]: "settings"
    };

    const settings = DesktopSettings.fromEnvironment(environment, resolve("user"), resolve("module"), "2.0.0");

    Assert.areEqual(resolve("relative", "data"), settings.dataDirectory);
    Assert.areEqual(resolve("custom/index.html"), settings.rendererIndexPath);
    Assert.areEqual("http://localhost:4200", settings.rendererUrl);
    Assert.areEqual("evidence.png", settings.screenshotPath);
    Assert.areEqual(42, settings.screenshotDelayMilliseconds);
    Assert.areEqual("settings", settings.startView);
  }

  @TestMethod
  public rejectsInvalidValues(): void {
    const create = (data: string, version: string, index: string, delay: number): DesktopSettings =>
      new DesktopSettings(data, version, index, DesktopSettingsTests.icon, null, null, delay);

    Assert.areEqual("dataDirectory", Assert.throws(() => create(" ", "1", DesktopSettingsTests.index, 1), ArgumentException).parameterName);
    Assert.areEqual("dataDirectory", Assert.throws(() => create("relative", "1", DesktopSettingsTests.index, 1), ArgumentException).parameterName);
    const version = Assert.throws(() => create(DesktopSettingsTests.data, "", DesktopSettingsTests.index, 1), ArgumentException);
    Assert.areEqual("productVersion", version.parameterName);
    Assert.areEqual("rendererIndexPath", Assert.throws(() => create(DesktopSettingsTests.data, "1", "", 1), ArgumentException).parameterName);
    const icon = Assert.throws(() => new DesktopSettings(DesktopSettingsTests.data, "1", DesktopSettingsTests.index, " ", null, null, 1), ArgumentException);
    Assert.areEqual("iconPath", icon.parameterName);
    Assert.throws(() => create(DesktopSettingsTests.data, "1", DesktopSettingsTests.index, 0), ArgumentOutOfRangeException);
    Assert.throws(() => create(DesktopSettingsTests.data, "1", DesktopSettingsTests.index, 1.5), ArgumentOutOfRangeException);
  }
}
