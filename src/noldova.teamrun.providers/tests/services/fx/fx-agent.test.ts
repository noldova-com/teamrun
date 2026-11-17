/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExecutableNotFoundException, FxAgent, FxUsageReader, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class FxAgentTests {
  @TestMethod
  public findsFxOnceItIsInstalledAndFailsUntilThen(): void {
    using directory = new TemporaryDirectory();
    let installed: ProcessCommand | null = null;
    const agent = new FxAgent(null, { HOME: directory.path }, () => installed, "linux");

    Assert.areEqual(Resources.fxNotFound, Assert.throws(() => agent.launch(null, null), ExecutableNotFoundException).message);
    Assert.areEqual(Resources.fxWindowsNotFound, Assert.throws(() => new FxAgent(null, {}, () => null, "win32").launch(null, null), ExecutableNotFoundException).message);
    installed = new ProcessCommand("fx", []);
    const launch = agent.launch(null, null);
    const inChat = agent.launch(null, null, directory.resolve("chat"));

    Assert.areEqual("fx|acp|" + directory.path + "|" + directory.resolve("chat"), [launch.command.executable, launch.command.arguments.join(" "), launch.directory,
      inChat.directory].join("|"));
    Assert.isFalse(existsSync(join(directory.path, Resources.profileMarker)));
    Assert.isFalse(existsSync(join(directory.path, ".fx")));
  }

  @TestMethod
  public namesThePersonsOwnFxAsItsOnlyProfileOnEveryPlatform(): void {
    const profile = resolve("/profiles/ann");
    const cases: readonly (readonly [string, NodeJS.ProcessEnv, string])[] = [["linux", { HOME: "/home/ann" }, "/home/ann"],
      ["darwin", { HOME: "/Users/ann" }, "/Users/ann"], ["win32", { USERPROFILE: profile, HOME: "/elsewhere" }, profile]];

    for (const [platform, environment, home] of cases) {
      const agent = new FxAgent(null, environment, undefined, platform);
      const own = join(home, ".fx");

      Assert.areEqual(Resources.fxOneAccountPerComputer, agent.descriptor.singleAccount, platform);
      Assert.areEqual(JSON.stringify({ variable: "FX_HOME", signInCommand: "fx login", usualFolder: own, toolCommand: null, signInVariables: {}, signInValues: {},
        personFolders: [own] }), JSON.stringify(agent.descriptor.profile?.toJson()), platform);
      Assert.areEqual(`${own}|settings.json,auth.json`, `${agent.profileSearch.folders.join(",")}|${agent.profileSearch.entries.join(",")}`, platform);
      Assert.isFalse("prepareProfile" in agent, platform);
    }
  }

  @TestMethod
  public leavesWhatTheSessionNamesToTheSessionAndSaysHowToSignIn(): void {
    const agent = new FxAgent(null, {}, undefined, "darwin");

    Assert.areEqual("null|null|null|null|null|null|null", [agent.isSignedIn(null), agent.readModels(JsonReader.fromValue({})), agent.readSignInMethod(JsonReader.fromValue({})),
      agent.readEffort(JsonReader.fromValue({})), agent.memberOf("openai/gpt-5", "openai/gpt-5"), agent.sessionMeta(), agent.formatUnsupported("0.0.16")].map(String).join("|"));
    Assert.isNull(agent.readVersion(JsonReader.fromValue({})));
    Assert.areEqual(Resources.fxSignedOut, agent.formatSignIn(null));
    Assert.isTrue(Resources.fxSignedOut.includes("fx login"));
    Assert.areEqual("fx stopped before completing the turn: max_tokens.", agent.formatStopped("max_tokens"));
    Assert.isTrue(agent.isSignedOutRefusal(-32600, "fx needs access to Vercel AI Gateway. Run fx login to sign in."));
    Assert.isFalse(agent.isSignedOutRefusal(-32600, "Credential refresh is temporarily unavailable. Retry shortly."));
    Assert.isFalse(agent.isSignedOutRefusal(-32000, "Run fx login to sign in."));
    Assert.isFalse(agent.isSignedOutRefusal(null, "Run fx login to sign in."));
    Assert.areEqual("model|false|false|0|null", [agent.modelOption, agent.compacts, agent.followsTasks, agent.forkMethods.length,
      String(agent.sharedServerRefusal)].join("|"));
  }

  @TestMethod
  public readsARepliesTokensAndNoContextOrPlan(): void {
    const reader = new FxUsageReader();

    const partial = reader.readReply({ stopReason: "end_turn", usage: { outputTokens: 5 } });

    Assert.areEqual("null:5:null:null:null", [partial?.inputTokens, partial?.outputTokens, partial?.cacheReadTokens, partial?.cacheWriteTokens, partial?.reasoningTokens]
      .map(String).join(":"));
    Assert.isNull(reader.readReply({ stopReason: "end_turn" }));
    Assert.isNull(reader.readContext({}));
    Assert.isNull(reader.readPlan({}));
    Assert.areEqual(0, reader.contextMethods.length + reader.planMethods.length);
  }

  @TestMethod
  public async listsThePersonsOwnServersFromTheMcpFileInTheirHomesFxFolderWhateverFxHomeSays(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const fxHome = directory.resolve("fx-home");
    for (const [folder, name] of [[join(home, ".fx"), "docs"], [fxHome, "inFxHome"]] as const) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "mcp.json"), JSON.stringify({ mcpServers: { [name]: { command: name }, teamrun: { url: "http://127.0.0.1:1/mcp" } } }));
    }
    writeFileSync(join(home, ".mcp.json"), JSON.stringify({ mcpServers: { project: { command: "project" } } }));

    Assert.areEqual(JSON.stringify([{ name: "docs", state: "Configured" }]),
      JSON.stringify((await new FxAgent(null, { HOME: home, FX_HOME: fxHome }, undefined, "linux").listOwnMcpServers(null)).map(t => t.toJson())));
    Assert.areEqual(0, (await new FxAgent(null, { HOME: fxHome }, undefined, "linux").listOwnMcpServers(null)).length);
  }
}
