/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ClientSettings, DataDirectory, LaunchSettings } from "@noldova/teamrun-shell-runtime";

@TestClass
export class LaunchSettingsTests {
  private static readonly DIRECTORY: DataDirectory = new DataDirectory(path.resolve("data"));

  @TestMethod
  public defaultsToTheRuntimeLimits(): void {
    const environment = { HOME: "/home/person" };
    const settings = new LaunchSettings(LaunchSettingsTests.DIRECTORY, "/opt/node", "/opt/entry.js", environment, "linux");

    Assert.areEqual(LaunchSettingsTests.DIRECTORY, settings.dataDirectory);
    Assert.areEqual("/opt/node", settings.executablePath);
    Assert.areEqual("/opt/entry.js", settings.entryPath);
    Assert.areEqual(environment, settings.environment);
    Assert.areEqual("linux", settings.platform);
    Assert.areEqual(30_000, settings.idleGraceMilliseconds);
    Assert.areEqual(20_000, settings.launchTimeout);
    Assert.areEqual(100, settings.pollInterval);
    Assert.areEqual(5_000, settings.clientSettings.handshakeTimeout);
  }

  @TestMethod
  public keepsTheGivenLimits(): void {
    const client = new ClientSettings(1, 2, 3, 4);
    const settings = new LaunchSettings(LaunchSettingsTests.DIRECTORY, "node", "entry.js", {}, "win32", 10, 20, 30, client);

    Assert.areEqual(10, settings.idleGraceMilliseconds);
    Assert.areEqual(20, settings.launchTimeout);
    Assert.areEqual(30, settings.pollInterval);
    Assert.areEqual(client, settings.clientSettings);
  }

  @TestMethod
  public rejectsInvalidValues(): void {
    const directory = LaunchSettingsTests.DIRECTORY;
    Assert.areEqual("executablePath", Assert.throws(() => new LaunchSettings(directory, " ", "entry.js", {}, "linux"), ArgumentException).parameterName);
    Assert.areEqual("entryPath", Assert.throws(() => new LaunchSettings(directory, "node", "", {}, "linux"), ArgumentException).parameterName);
    Assert.areEqual("idleGraceMilliseconds", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("launchTimeout", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("pollInterval", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
