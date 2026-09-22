/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, resolve } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliSettings, CommandLine, OutputFormat } from "@noldova/teamrun-cli";

@TestClass
export class CliSettingsTests {
  @TestMethod
  public readsGlobalOptionsWithDefaults(): void {
    const defaults = CliSettings.fromCommandLine(CommandLine.parse(["providers"]), "/home/ross");
    const explicit = CliSettings.fromCommandLine(CommandLine.parse(["providers", "--data-dir", "data", "--json", "--idle-grace", "500", "--runtime-providers", "none"]));

    Assert.areEqual(resolve(join("/home/ross", ".noldova", "teamrun")), defaults.dataDirectory);
    Assert.areEqual(OutputFormat.Text, defaults.format);
    Assert.isFalse(defaults.isJson);
    Assert.areEqual(30_000, defaults.idleGraceMilliseconds);
    Assert.isNull(defaults.runtimeProviders);
    Assert.areEqual(0, defaults.runtimeArguments.length);
    Assert.areEqual(resolve("data"), explicit.dataDirectory);
    Assert.isTrue(explicit.isJson);
    Assert.areEqual(500, explicit.idleGraceMilliseconds);
    Assert.areEqual("--providers,none", explicit.runtimeArguments.join(","));
    Assert.isTrue(explicit.productVersion.length > 0);
    Assert.throws(() => new CliSettings(" ", OutputFormat.Text, 1, null, "1"), ArgumentException);
    Assert.throws(() => new CliSettings("/d", OutputFormat.Text, 1, null, ""), ArgumentException);
  }
}
