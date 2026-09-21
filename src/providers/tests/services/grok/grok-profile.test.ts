/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { GrokProfile } from "@noldova/teamrun-providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokProfileTests {
  @TestMethod
  public ownsOnlyItsConfigurationAndRefusesUnmanagedProfiles(): void {
    using directory = new TemporaryDirectory();
    Assert.throws(() => new GrokProfile("relative"), ArgumentException);
    const profile = new GrokProfile(directory.resolve("managed"));
    profile.prepare();
    writeFileSync(directory.resolve("managed", "native-owned.fixture"), "preserve");
    profile.prepare();
    Assert.areEqual("preserve", readFileSync(directory.resolve("managed", "native-owned.fixture"), "utf8"));
    Assert.isTrue(readFileSync(directory.resolve("managed", "requirements.toml"), "utf8").includes("allowed_mcp_servers = []"));
    Assert.areEqual(5, readdirSync(profile.directory).length);
    writeFileSync(directory.resolve("managed", ".teamrun-managed-profile"), "not TeamRun");
    Assert.throws(() => profile.prepare(), Error);
    writeFileSync(directory.resolve("user-file"), "unchanged");
    Assert.throws(() => new GrokProfile(directory.path).prepare(), Error);
    Assert.areEqual("unchanged", readFileSync(directory.resolve("user-file"), "utf8"));
    mkdirSync(directory.resolve("empty"));
    new GrokProfile(directory.resolve("empty")).prepare();
  }
}
