/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GeminiFolderTrust } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GeminiFolderTrustTests {
  private static write(path: string, content: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  }

  private static setUp(directory: TemporaryDirectory): { project: string; home: string; environment: NodeJS.ProcessEnv } {
    const project = directory.resolve("work", "project");
    mkdirSync(project, { recursive: true });
    const home = directory.resolve("home");
    return { project, home, environment: { GEMINI_CLI_HOME: home, GEMINI_CLI_SYSTEM_SETTINGS_PATH: directory.resolve("system", "settings.json") } };
  }

  @TestMethod
  public findsAFolderUntrustedUnlessTheLongestEntryHoldingItOrItsParentTrustsIt(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    const work = directory.resolve("work");
    const of = (rules: Readonly<Record<string, string>> | null, platform: string = process.platform): boolean => {
      if (rules !== null)
        GeminiFolderTrustTests.write(join(home, ".gemini", "trustedFolders.json"), rules);
      return GeminiFolderTrust.isUntrusted(environment, project, [], platform);
    };

    Assert.isTrue(of(null), "no trust file");
    Assert.isFalse(of({ [project]: "TRUST_FOLDER" }), "the folder");
    Assert.isFalse(of({ [work]: "TRUST_FOLDER" }), "its parent");
    Assert.isTrue(of({ [work]: "TRUST_FOLDER", [project]: "DO_NOT_TRUST" }), "the longest entry wins");
    Assert.isFalse(of({ [join(work, "sibling")]: "TRUST_PARENT" }), "a sibling's parent");
    Assert.isTrue(of({ [join(project, "inner")]: "TRUST_FOLDER" }), "a folder inside it");
    Assert.isTrue(of({ [`${project}-other`]: "TRUST_FOLDER" }), "a folder its name starts");
    Assert.isTrue(of({ [project]: "DO_NOT_TRUST" }), "distrusted");
    Assert.isFalse(of({ [project.toUpperCase()]: "TRUST_FOLDER" }, "win32"), "case ignored on Windows");
    Assert.isFalse(of({ [project.toUpperCase()]: "TRUST_FOLDER" }, "darwin"), "case ignored on macOS");
    Assert.isFalse(of({ [project]: "TRUST_FOLDER" }, "linux"), "the same case on Linux");
  }

  @TestMethod
  public takesAParentRulesStoredParentBeforeResolvingItAndWeighsRulesByTheirStoredLength(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    const work = directory.resolve("work");
    const elsewhere = directory.resolve("elsewhere", "target");
    mkdirSync(elsewhere, { recursive: true });
    const linked = join(work, "linked");
    symlinkSync(elsewhere, linked, "junction");
    const of = (rules: Readonly<Record<string, string>>): boolean => {
      GeminiFolderTrustTests.write(join(home, ".gemini", "trustedFolders.json"), rules);
      return GeminiFolderTrust.isUntrusted(environment, project);
    };

    Assert.isFalse(of({ [linked]: "TRUST_PARENT" }), "a linked rule's stored parent");
    Assert.isTrue(of({ [join(elsewhere, "inner")]: "TRUST_PARENT", [linked]: "TRUST_FOLDER" }), "a rule elsewhere");
    Assert.isTrue(of({ [linked]: "TRUST_PARENT", [[work, "project", "..", "project"].join(sep)]: "DO_NOT_TRUST" }), "the longer stored rule wins");
    Assert.isFalse(of({ [[work, "linked", "..", "linked"].join(sep)]: "TRUST_PARENT", [project]: "DO_NOT_TRUST" }), "the longer stored parent rule wins");
  }

  @TestMethod
  public followsGeminiClisVariablesAndSkipTrustArgumentAheadOfTheTrustFile(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    GeminiFolderTrustTests.write(join(home, ".gemini", "trustedFolders.json"), { [project]: "TRUST_FOLDER" });

    Assert.isTrue(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_CLI_TRUST_WORKSPACE: "false" }, project));
    Assert.isTrue(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_RESTRICTED_MODE: "true" }, project));
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_RESTRICTED_MODE: "false" }, project));
    GeminiFolderTrustTests.write(join(home, ".gemini", "trustedFolders.json"), {});
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_CLI_TRUST_WORKSPACE: "true" }, project));
    Assert.isFalse(GeminiFolderTrust.isUntrusted(environment, project, ["--experimental-acp", "--skip-trust"]));
    Assert.isTrue(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_CLI_TRUST_WORKSPACE: "" }, project, ["--experimental-acp"]));
  }

  @TestMethod
  public findsNoFolderUntrustedWhenTheMergedSettingsTurnFolderTrustOffTheSystemSettingsWinning(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    const off = { security: { folderTrust: { enabled: false } } };
    const on = { security: { folderTrust: { enabled: true } } };
    const user = join(home, ".gemini", "settings.json");
    const system = directory.resolve("system", "settings.json");
    const defaults = directory.resolve("system", "system-defaults.json");

    GeminiFolderTrustTests.write(user, off);
    Assert.isFalse(GeminiFolderTrust.isUntrusted(environment, project), "off in the user's settings");
    GeminiFolderTrustTests.write(system, on);
    Assert.isTrue(GeminiFolderTrust.isUntrusted(environment, project), "on in the system's");
    GeminiFolderTrustTests.write(system, {});
    GeminiFolderTrustTests.write(user, { security: { folderTrust: "off" } });
    GeminiFolderTrustTests.write(defaults, off);
    Assert.isFalse(GeminiFolderTrust.isUntrusted(environment, project), "off in the system defaults beside the system settings");
    GeminiFolderTrustTests.write(user, on);
    Assert.isTrue(GeminiFolderTrust.isUntrusted(environment, project), "on in the user's over the defaults");
    const named = directory.resolve("named-defaults.json");
    GeminiFolderTrustTests.write(defaults, on);
    GeminiFolderTrustTests.write(named, off);
    GeminiFolderTrustTests.write(user, {});
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_CLI_SYSTEM_DEFAULTS_PATH: named }, project), "off in named defaults");
  }

  @TestMethod
  public findsNoFolderUntrustedWhenItCantBeSure(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    const user = join(home, ".gemini", "settings.json");
    const trust = join(home, ".gemini", "trustedFolders.json");
    const cases: readonly (readonly [string, string, unknown])[] = [
      ["settings with comments", user, "{\n  // a comment\n}"],
      ["settings that aren't an object", user, "[]"],
      ["an IDE that gives the trust", user, { ide: { enabled: true } }],
      ["a trust file that isn't JSON", trust, "not json"],
      ["a trust file that isn't an object", trust, "[]"],
      ["a trust level Gemini CLI refuses", trust, { [project]: "TRUST" }]
    ];

    for (const [name, path, content] of cases) {
      GeminiFolderTrustTests.write(user, {});
      GeminiFolderTrustTests.write(trust, {});
      GeminiFolderTrustTests.write(path, content);
      Assert.isFalse(GeminiFolderTrust.isUntrusted(environment, project), name);
    }
    GeminiFolderTrustTests.write(user, { ide: { enabled: false } });
    GeminiFolderTrustTests.write(trust, {});
    Assert.isTrue(GeminiFolderTrust.isUntrusted(environment, project), "an IDE turned off");
  }

  @TestMethod
  public readsTheTrustFileWhereGeminiCliKeepsIt(): void {
    using directory = new TemporaryDirectory();
    const { project, home, environment } = GeminiFolderTrustTests.setUp(directory);
    const trusted = { [project]: "TRUST_FOLDER" };
    const named = directory.resolve("named", "trusted.json");
    GeminiFolderTrustTests.write(named, trusted);
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...environment, GEMINI_CLI_TRUSTED_FOLDERS_PATH: named }, project), "named by its variable");

    GeminiFolderTrustTests.write(join(home, ".cache", ".gemini", "trustedFolders.json"), trusted);
    Assert.isTrue(GeminiFolderTrust.isUntrusted(environment, project), "the sandbox's file outside the sandbox");
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...environment, SANDBOX: "sandbox-exec" }, project), "in the macOS sandbox");

    const person = directory.resolve("person");
    GeminiFolderTrustTests.write(join(person, ".gemini", "trustedFolders.json"), trusted);
    const homes = { GEMINI_CLI_SYSTEM_SETTINGS_PATH: environment["GEMINI_CLI_SYSTEM_SETTINGS_PATH"], HOME: person, USERPROFILE: person };
    Assert.isFalse(GeminiFolderTrust.isUntrusted(homes, project), "the person's home");
    Assert.isFalse(GeminiFolderTrust.isUntrusted({ ...homes, GEMINI_CLI_HOME: "" }, project), "an empty GEMINI_CLI_HOME");
  }
}
