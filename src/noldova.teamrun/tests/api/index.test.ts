/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ICliPartContext } from "@noldova/desktop.cli";
import * as api from "@noldova/teamrun/runtime";
import * as cli from "@noldova/teamrun/cli";
import { CliPart } from "@noldova/teamrun.cli";
import { RuntimePart } from "@noldova/teamrun.runtime";

@TestClass
export class TeamRunApiTests {
  @TestMethod
  public exportsTheRuntimePartAtItsPartsName(): void {
    Assert.areEqual("RuntimePart", Object.keys(api).join(","));
    Assert.isTrue(api.RuntimePart === RuntimePart);
  }

  @TestMethod
  public declaresTheModuleAtThePackagesVersion(): void {
    const declaration = TeamRunApiTests.read("module.json");
    const manifest = TeamRunApiTests.read("package.json");

    Assert.areEqual("teamrun", declaration["id"]);
    Assert.areEqual(manifest["version"], declaration["version"]);
    Assert.areEqual(["runtime", "window", "cli"].join(","), (declaration["parts"] as readonly string[]).join(","));
  }

  @TestMethod
  public dependsOnTheCheckpointsAndTerminalModulesAtTheVersionsItsPartsBuildOn(): void {
    const declaration = TeamRunApiTests.read("module.json");
    const peers = (name: string): Readonly<Record<string, string>> =>
      (JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(`${name}/package.json`)), "utf8")) as Readonly<Record<string, unknown>>)["peerDependencies"] as
        Readonly<Record<string, string>>;
    const checkpoints = peers("@noldova/teamrun.runtime")["@noldova/checkpoints"];
    const terminal = peers("@noldova/teamrun.window")["@noldova/terminal.window"];

    Assert.isTrue([checkpoints, terminal].every(t => /^\d+\.\d+\.\d+$/.test(t ?? String.empty)));
    Assert.areEqual(JSON.stringify({ checkpoints, terminal }), JSON.stringify(declaration["dependencies"]));
  }

  @TestMethod
  public namesTheBrowserComputerUseGitAndGitHubAsOptionalDependenciesWithComputerUseGitAndGitHubAtTheVersionsItsSpecsAndWindowInstall(): void {
    const optional = TeamRunApiTests.read("module.json")["optionalDependencies"];
    const installed = readFileSync(fileURLToPath(import.meta.resolve("@noldova/computer-use.runtime/package.json")), "utf8");
    const version = /"version": "(\d+\.\d+\.\d+)"/.exec(installed)?.[1];
    const windowManifest = readFileSync(fileURLToPath(import.meta.resolve("@noldova/teamrun.window/package.json")), "utf8");
    const gitHub = /"@noldova\/git\.github\.window": "(\d+\.\d+\.\d+)"/.exec(windowManifest)?.[1];
    const git = /"@noldova\/git\.protocol": "(\d+\.\d+\.\d+)"/.exec(windowManifest)?.[1];
    const versions = new Map<string, unknown>(typeof optional === "object" && optional !== null ? Object.entries(optional) : []);

    Assert.isTrue([gitHub, git].every(t => /^\d+\.\d+\.\d+$/.test(t ?? String.empty)));
    Assert.isTrue(/^\d+\.\d+\.\d+$/.test(String(versions.get("browser"))));
    Assert.areEqual(JSON.stringify([version, git, gitHub]), JSON.stringify([versions.get("computer-use"), versions.get("git"), versions.get("git-github")]));
  }

  @TestMethod
  public exportsTheWindowPartFromItsOwnPackageAtTheExactVersion(): void {
    const manifest = TeamRunApiTests.read("package.json");
    const exports = manifest["exports"] as Readonly<Record<string, unknown>>;
    const dependencies = manifest["dependencies"] as Readonly<Record<string, string>>;

    Assert.isTrue("./window" in exports);
    Assert.areEqual(manifest["version"], dependencies["@noldova/teamrun.window"]);
  }

  @TestMethod
  public exportsTheCliPartFromItsOwnPackageAtTheExactVersion(): void {
    const manifest = TeamRunApiTests.read("package.json");
    const dependencies = manifest["dependencies"] as Readonly<Record<string, string>>;

    Assert.areEqual("CliPart", Object.keys(cli).join(","));
    Assert.isTrue(cli.CliPart === CliPart);
    Assert.areEqual(manifest["version"], dependencies["@noldova/teamrun.cli"]);
    Assert.isTrue((manifest["files"] as readonly string[]).includes("cli.json"));
  }

  @TestMethod
  public async definesInCliJsonTheCommandsTheModuleDeclaresAndThePartRegisters(): Promise<void> {
    const declared = ((TeamRunApiTests.read("module.json")["contributes"] as Readonly<Record<string, unknown>>)["cliCommands"] as readonly string[]).join(",");
    const defined = TeamRunApiTests.read("cli.json") as { readonly commands: readonly { readonly name: string }[] };
    const registered: string[] = [];
    const context: ICliPartContext = {
      moduleId: "teamrun",
      get secrets(): ICliPartContext["secrets"] {
        throw new Error("The test keeps no secrets.");
      },
      registerCommand: t => { registered.push(t); },
      requestAsync: () => Promise.resolve(null)
    };

    await new cli.CliPart().activateAsync(context);

    Assert.areEqual(21, defined.commands.length);
    Assert.areEqual(declared, defined.commands.map(t => t.name).join(","));
    Assert.areEqual(declared, registered.join(","));
  }

  @TestMethod
  public saysChatNeverConversationInEveryTextItsDeclarationsHold(): void {
    const texts = TeamRunApiTests.declarationTexts();

    Assert.isTrue(texts.includes("Chat"));
    Assert.areEqual("", texts.filter(t => /conversation/i.test(t)).join(" | "));
  }

  @TestMethod
  public neverCallsAProviderAnAccountInEveryTextItsDeclarationsHold(): void {
    const texts = TeamRunApiTests.declarationTexts();

    Assert.isTrue(texts.length > 100);
    Assert.areEqual("", texts.filter(t => /account/i.test(t)).join(" | "));
  }

  @TestMethod
  public declaresTheChatMenuOnTheMenuBarAndTheGroupsOfItsCommands(): void {
    const menus = TeamRunApiTests.read("menus.json") as {
      readonly places: readonly unknown[];
      readonly groups: readonly { readonly name: string; readonly place: string; readonly items: readonly { readonly command: string }[] }[];
    };
    const declared = (TeamRunApiTests.read("module.json")["contributes"] as Readonly<Record<string, unknown>>)["menus"];

    Assert.areEqual(JSON.stringify([{ name: "teamrun.chats", title: "Chat", shows: "menuBar" }]), JSON.stringify(menus.places));
    Assert.areEqual(JSON.stringify(["teamrun.chats"]), JSON.stringify(declared));
    Assert.areEqual(JSON.stringify([
      ["teamrun.start", "teamrun.chats", ["teamrun.newConversation", "teamrun.openProject"]],
      ["teamrun.move", "teamrun.chats", ["teamrun.searchConversations", "teamrun.previousConversation", "teamrun.nextConversation"]],
      ["teamrun.reply", "teamrun.chats", ["teamrun.focusComposer", "teamrun.stopReply"]],
      ["teamrun.manage", "desktop.view", ["teamrun.showOrganization", "teamrun.showTeammates", "teamrun.showProviders", "teamrun.showMcpServers", "teamrun.showComputerUseGrants"]],
      ["teamrun.terminals", "terminal.shellMenu", ["teamrun.newChatTerminal"]]
    ]), JSON.stringify(menus.groups.map(t => [t.name, t.place, t.items.map(u => u.command)])));
  }

  @TestMethod
  public declaresEverySettingModuleJsonNamesWithTheSendKeyAndOutsideSessionsAsTheirPartsReadThem(): void {
    const settings = (TeamRunApiTests.read("settings.json") as { readonly settings: readonly Readonly<Record<string, unknown>>[] }).settings;
    const declared = (TeamRunApiTests.read("module.json")["contributes"] as Readonly<Record<string, unknown>>)["settings"];
    const of = (name: string): readonly unknown[] => {
      const setting = settings.find(t => t["name"] === name);
      return [setting?.["default"], setting?.["locality"], setting?.["page"], setting?.["group"]];
    };
    const sendKey = settings.find(t => t["name"] === "teamrun.sendKey")?.["type"] as { readonly kind: string; readonly options: readonly { readonly value: string }[] } | undefined;

    Assert.areEqual(JSON.stringify(declared), JSON.stringify(settings.map(t => t["name"])));
    Assert.areEqual(JSON.stringify(["Choice", ["Enter", "ModEnter"], "Enter", "Device", "TeamRun", "Composer"]),
      JSON.stringify([sendKey?.kind, sendKey?.options.map(t => t.value), ...of("teamrun.sendKey")]));
    Assert.areEqual(JSON.stringify([[false, "Shared", "TeamRun", "Outside sessions"], [47391, "Shared", "TeamRun", "Outside sessions"]]),
      JSON.stringify([of("teamrun.outsideSessions"), of("teamrun.outsidePort")]));
  }

  private static declarationTexts(): readonly string[] {
    return ["module.json", "settings.json", "menus.json", "cli.json"].flatMap(t => TeamRunApiTests.textsOf(TeamRunApiTests.read(t)));
  }

  private static textsOf(value: unknown): readonly string[] {
    if (typeof value === "string")
      return /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(value) ? [] : [value];
    if (typeof value === "object" && value !== null)
      return Object.values(value).flatMap(t => TeamRunApiTests.textsOf(t));
    return [];
  }

  private static read(name: string): Readonly<Record<string, unknown>> {
    return JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(`@noldova/teamrun/${name}`)), "utf8")) as Readonly<Record<string, unknown>>;
  }
}
