/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderProfile } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderProfileTests {
  private static readonly json: object = { variable: "COPILOT_HOME", signInCommand: "copilot login", usualFolder: "/home/person/.copilot", toolCommand: "copilot",
    signInVariables: {}, signInValues: {}, personFolders: [] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderProfile.fromJson(ProviderProfileTests.json);

    Assert.areEqual("COPILOT_HOME", value.variable);
    Assert.areEqual("copilot login", value.signInCommand);
    Assert.areEqual("/home/person/.copilot", value.usualFolder);
    Assert.areEqual("copilot", value.toolCommand);
    Assert.areEqual(JSON.stringify(ProviderProfileTests.json), JSON.stringify(value.toJson()));
    Assert.isNull(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).signInCommand);
    Assert.isNull(new ProviderProfile("CODEX_HOME").signInCommand);
    Assert.isNull(new ProviderProfile("CODEX_HOME").usualFolder);
    Assert.isNull(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).usualFolder);
    Assert.isNull(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null, usualFolder: null }).usualFolder);
    Assert.isNull(new ProviderProfile("CODEX_HOME").toolCommand);
    Assert.isNull(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).toolCommand);
    Assert.isNull(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null, toolCommand: null }).toolCommand);
    Assert.areEqual("{}", JSON.stringify(new ProviderProfile("CODEX_HOME").signInVariables));
    Assert.areEqual("{}", JSON.stringify(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).signInVariables));
    Assert.areEqual("{}", JSON.stringify(new ProviderProfile("CODEX_HOME").signInValues));
    Assert.areEqual("{}", JSON.stringify(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).signInValues));
  }

  @TestMethod
  public carriesTheSignInVariablesAsFoldersInsideTheProfileFolder(): void {
    const json = { variable: "XDG_DATA_HOME", signInCommand: "opencode auth login", usualFolder: null, toolCommand: null,
      signInVariables: { XDG_CONFIG_HOME: "config", XDG_STATE_HOME: "home/.local/state" }, signInValues: {}, personFolders: [] };
    const value = ProviderProfile.fromJson(json);

    Assert.areEqual("config", value.signInVariables["XDG_CONFIG_HOME"]);
    Assert.areEqual("home/.local/state", value.signInVariables["XDG_STATE_HOME"]);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    const variables: Record<string, string> = { XDG_CACHE_HOME: "cache" };
    const kept = new ProviderProfile("XDG_DATA_HOME", null, null, null, variables);
    variables["XDG_CACHE_HOME"] = "other";
    Assert.areEqual("cache", kept.signInVariables["XDG_CACHE_HOME"]);
  }

  @TestMethod
  public refusesASignInVariableThatIsntANameOrTheProfilesOwnOrLeavesTheProfileFolder(): void {
    for (const name of ["2HOME", "XDG-CONFIG", "A B", String.empty])
      Assert.areEqual("signInVariables", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, { [name]: "config" }), ArgumentException).parameterName);
    Assert.areEqual("signInVariables", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, { XDG_DATA_HOME: "data" }), ArgumentException).parameterName);
    for (const folder of [String.empty, " ", ".", "..", "../config", "config/..", "a/./b", "/config", "config/", "a\\b", "C:config", "~/config"])
      Assert.areEqual("signInVariables", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, { XDG_CONFIG_HOME: folder }), ArgumentException).parameterName);
    for (const folder of ["config", ".config", "home/.local/share", "a-b_c.d"])
      Assert.areEqual(folder, new ProviderProfile("XDG_DATA_HOME", null, null, null, { XDG_CONFIG_HOME: folder }).signInVariables["XDG_CONFIG_HOME"]);
  }

  @TestMethod
  public carriesTheSignInValuesAsTheyAreEvenBlank(): void {
    const json = { variable: "XDG_DATA_HOME", signInCommand: "opencode auth login", usualFolder: null, toolCommand: null,
      signInVariables: { XDG_CONFIG_HOME: "config" }, signInValues: { OPENCODE_CONFIG: "", OPENCODE_DISABLE_PROJECT_CONFIG: "1" }, personFolders: [] };
    const value = ProviderProfile.fromJson(json);

    Assert.areEqual("", value.signInValues["OPENCODE_CONFIG"]);
    Assert.areEqual("1", value.signInValues["OPENCODE_DISABLE_PROJECT_CONFIG"]);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    const values: Record<string, string> = { OPENCODE_CONFIG: "" };
    const kept = new ProviderProfile("XDG_DATA_HOME", null, null, null, {}, values);
    values["OPENCODE_CONFIG"] = "/elsewhere";
    Assert.areEqual("", kept.signInValues["OPENCODE_CONFIG"]);
  }

  @TestMethod
  public refusesASignInValueThatIsntANameSetsAnotherOfTheProfilesVariablesOrHoldsANullCharacter(): void {
    for (const name of ["2HOME", "OPENCODE-CONFIG", "A B", String.empty])
      Assert.areEqual("signInValues", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, {}, { [name]: "" }), ArgumentException).parameterName);
    Assert.areEqual("signInValues", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, {}, { XDG_DATA_HOME: "" }), ArgumentException).parameterName);
    Assert.areEqual("signInValues", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, { XDG_CONFIG_HOME: "config" },
      { XDG_CONFIG_HOME: "/elsewhere" }), ArgumentException).parameterName);
    Assert.areEqual("signInValues", Assert.throws(() => new ProviderProfile("XDG_DATA_HOME", null, null, null, {}, { OPENCODE_CONFIG: "a\0b" }), ArgumentException).parameterName);
  }

  @TestMethod
  public carriesThePersonFoldersAndRefusesABlankOne(): void {
    const json = { variable: "GROK_HOME", signInCommand: null, usualFolder: "/home/person/.grok", toolCommand: null, signInVariables: {}, signInValues: {},
      personFolders: ["/home/person/.grok", "/data/profiles/grok/default"] };
    const value = ProviderProfile.fromJson(json);

    Assert.areEqual(JSON.stringify(json.personFolders), JSON.stringify(value.personFolders));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual("[]", JSON.stringify(ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null }).personFolders));
    const folders = ["/home/person/.grok"];
    const kept = new ProviderProfile("GROK_HOME", null, null, null, {}, {}, folders);
    folders.push("/elsewhere");
    Assert.areEqual(1, kept.personFolders.length);
    for (const folder of [String.empty, " "])
      Assert.areEqual("personFolders", Assert.throws(() => new ProviderProfile("GROK_HOME", null, null, null, {}, {}, [folder]), ArgumentException).parameterName);
    const path = Assert.throws(() => ProviderProfile.fromJson({ variable: "GROK_HOME", signInCommand: null, personFolders: [1] }), JsonException).path;
    Assert.isTrue(path.startsWith("$.personFolders"), path);
  }

  @TestMethod
  public takesOnlyAnEnvironmentVariableNameAndAFilledCommand(): void {
    for (const variable of ["_HOME", "home2", "COPILOT_HOME"])
      Assert.areEqual(variable, new ProviderProfile(variable).variable);
    for (const variable of [String.empty, "2HOME", "CLAUDE-CONFIG", "A B", "HOME=/tmp", "HOME\n"])
      Assert.areEqual("variable", Assert.throws(() => new ProviderProfile(variable), ArgumentException).parameterName);
    Assert.throws(() => new ProviderProfile("CLAUDE_CONFIG_DIR", " "), ArgumentException);
    Assert.areEqual("usualFolder", Assert.throws(() => new ProviderProfile("CODEX_HOME", null, " "), ArgumentException).parameterName);
    Assert.areEqual("toolCommand", Assert.throws(() => new ProviderProfile("COPILOT_HOME", null, null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.areEqual("$.signInCommand", Assert.throws(() => ProviderProfile.fromJson({ variable: "CODEX_HOME" }), JsonException).path);
    Assert.areEqual("$.variable", Assert.throws(() => ProviderProfile.fromJson({ variable: " ", signInCommand: null }), JsonException).path);
    Assert.areEqual("$.usualFolder", Assert.throws(() => ProviderProfile.fromJson({ variable: "CODEX_HOME", signInCommand: null, usualFolder: 1 }),
      JsonException).path);
    Assert.areEqual("$.toolCommand", Assert.throws(() => ProviderProfile.fromJson({ variable: "COPILOT_HOME", signInCommand: null, toolCommand: 2 }),
      JsonException).path);
    Assert.areEqual("$.signInVariables", Assert.throws(() => ProviderProfile.fromJson({ variable: "XDG_DATA_HOME", signInCommand: null, signInVariables: [] }),
      JsonException).path);
    Assert.areEqual("$.signInVariables.XDG_CONFIG_HOME", Assert.throws(() => ProviderProfile.fromJson({ variable: "XDG_DATA_HOME", signInCommand: null,
      signInVariables: { XDG_CONFIG_HOME: 3 } }), JsonException).path);
    Assert.areEqual("$.signInValues.OPENCODE_CONFIG", Assert.throws(() => ProviderProfile.fromJson({ variable: "XDG_DATA_HOME", signInCommand: null,
      signInValues: { OPENCODE_CONFIG: null } }), JsonException).path);
  }
}
