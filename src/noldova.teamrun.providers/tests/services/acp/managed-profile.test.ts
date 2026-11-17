/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ManagedProfile, ProfileFolderException } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ManagedProfileTests {
  @TestMethod
  public marksAnEmptyFolderAndRefusesOneSomeoneElseOwns(): void {
    using directory = new TemporaryDirectory();
    const create = (path: string): ManagedProfile => new ManagedProfile(path, "Fake profile v1\n", "Use an absolute path.", "Not a managed profile.");
    Assert.areEqual("profileDirectory", Assert.throws(() => create("relative"), ArgumentException).parameterName);
    const profile = create(directory.resolve("managed"));
    profile.prepare();
    Assert.areEqual("Fake profile v1\n", readFileSync(directory.resolve("managed", ".teamrun-managed-profile"), "utf8"));
    profile.writeFile("settings.json", "{}");
    profile.writeFile("settings.json", "{\"a\":1}");
    profile.prepare();
    Assert.areEqual("{\"a\":1}", readFileSync(directory.resolve("managed", "settings.json"), "utf8"));
    Assert.areEqual(".teamrun-managed-profile,settings.json", readdirSync(profile.directory).sort().join(","));
    writeFileSync(directory.resolve("managed", ".teamrun-managed-profile"), "Another profile v1\n");
    Assert.areEqual("Not a managed profile.", Assert.throws(() => profile.prepare(), ProfileFolderException).message);
    mkdirSync(directory.resolve("owned"));
    writeFileSync(directory.resolve("owned", "user-file"), "unchanged");
    Assert.areEqual("Not a managed profile.", Assert.throws(() => create(directory.resolve("owned")).prepare(), ProfileFolderException).message);
    Assert.areEqual("user-file", readdirSync(directory.resolve("owned")).join(","));
    mkdirSync(directory.resolve("empty"));
    create(directory.resolve("empty")).prepare();
    Assert.areEqual(".teamrun-managed-profile", readdirSync(directory.resolve("empty")).join(","));
  }
}
