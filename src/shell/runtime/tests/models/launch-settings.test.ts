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
    Assert.areEqual(60_000, settings.launchLimit);
  }

  @TestMethod
  public keepsTheGivenLimits(): void {
    const client = new ClientSettings(1, 2, 3, 4);
    const settings = new LaunchSettings(LaunchSettingsTests.DIRECTORY, "node", "entry.js", {}, "win32", 10, 20, 30, client, 40);

    Assert.areEqual(10, settings.idleGraceMilliseconds);
    Assert.areEqual(20, settings.launchTimeout);
    Assert.areEqual(30, settings.pollInterval);
    Assert.areEqual(client, settings.clientSettings);
    Assert.areEqual(40, settings.launchLimit);
  }

  @TestMethod
  public waitsOnAnOwnedDirectoryAtLeastAsLongAsTheLaunchTimeoutByDefault(): void {
    const settings = new LaunchSettings(LaunchSettingsTests.DIRECTORY, "node", "entry.js", {}, "linux", 10, 90_000);

    Assert.areEqual(90_000, settings.launchLimit);
  }

  @TestMethod
  public rejectsInvalidValues(): void {
    const directory = LaunchSettingsTests.DIRECTORY;
    Assert.areEqual("executablePath", Assert.throws(() => new LaunchSettings(directory, " ", "entry.js", {}, "linux"), ArgumentException).parameterName);
    Assert.areEqual("entryPath", Assert.throws(() => new LaunchSettings(directory, "node", "", {}, "linux"), ArgumentException).parameterName);
    Assert.areEqual("idleGraceMilliseconds", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("launchTimeout", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("pollInterval", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 1, 0), ArgumentOutOfRangeException).parameterName);
    const client = new ClientSettings();
    Assert.areEqual("launchLimit", Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 1, 1, client, 0), ArgumentOutOfRangeException).parameterName);
    const short = Assert.throws(() => new LaunchSettings(directory, "node", "e", {}, "linux", 1, 20, 1, client, 10), ArgumentOutOfRangeException);
    Assert.areEqual("launchLimit", short.parameterName);
    Assert.isTrue(short.message.includes("The limit while the data directory is owned cannot be shorter than the launch timeout."));
  }
}
