/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type IProviderAdapter, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { AuthStatus, MessageAttachment, ProviderAbility, RequestedSettings, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { type IProcessStarter, NodeProcessStarter, ProcessCommand, ProviderAbilityTable, Resources, SignInException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { OpencodeTestHost } from "../../fixtures/opencode-test-host.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

@TestClass
export class OpencodeAdapterTests {
  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new OpencodeTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter(AcpCommandCheck.environment(host.directory.path)), host.request("unused"), host.directory.path);
  }

  @TestMethod
  public async takesSharedStdioAndHttpServers(): Promise<void> {
    await using host = new OpencodeTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

    Assert.isNull(adapter.sharedServerUnavailable(stdio));
    Assert.isNull(adapter.sharedServerUnavailable(http));
  }

  @TestMethod
  public async describesATerminalSignInWithItsFoldersASignOutCommandThatEndsItAndNoFork(): Promise<void> {
    await using host = new OpencodeTestHost();
    const descriptor = host.createAdapter().descriptor;

    Assert.areEqual("opencode:OpenCode:true:true:false:false:false", [descriptor.id, descriptor.displayName, descriptor.supportsResume, descriptor.supportsSignInCheck,
      descriptor.supportsFork, descriptor.supportsSignIn, descriptor.supportsSignOut].join(":"));
    Assert.areEqual("false:opencode auth logout:true", [descriptor.supportsSignOut, descriptor.signOutCommand, descriptor.signOutEndsWithCommand].join(":"));
    Assert.isNull(descriptor.ownMcpServersUnavailable);
    Assert.areEqual(Resources.opencodeOwnMcpServersNote, descriptor.ownMcpServersNote);
    Assert.areEqual("uses its own while on", descriptor.ownMcpServersShortNote);
    Assert.areEqual("false:true:false", [descriptor.reportsLimits, descriptor.carriesSessions, descriptor.sessionsChecked].join(":"));
    Assert.isTrue(descriptor.abilities === ProviderAbilityTable.opencode);
    Assert.areEqual(JSON.stringify({ variable: "XDG_DATA_HOME", signInCommand: "opencode auth login", usualFolder: host.directory.resolve("person-data"),
      toolCommand: null, signInVariables: {}, signInValues: {}, personFolders: [host.directory.resolve("person-data"), host.directory.resolve("default-profile")] }),
    JSON.stringify(descriptor.profile?.toJson()));
    const contract: IProviderAdapter = host.createAdapter();
    Assert.isUndefined(contract.installation);
    const refused = await Assert.throwsAsync(() => host.createAdapter().signIn(host.provider, new AbortController().signal), SignInException);
    Assert.areEqual(Resources.opencodeSignInUnavailable, refused.message);
  }

  @TestMethod
  public async checksThroughASessionAndListsTheModelsItOffersWithBuildPlanAndAllowAll(): Promise<void> {
    await using host = new OpencodeTestHost();
    const adapter = host.createAdapter();

    const check = await adapter.checkSignIn(host.provider);
    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus, check.error ?? "");
    Assert.areEqual("1.19.4", check.harnessVersion);
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual("anthropic/claude-sonnet-4-5,opencode/beam-free,opencode/big-pickle", listed.models.map(t => t.id).join(","));
    Assert.areEqual("build:Build:false:false,plan:Plan:false:true,allowAll:Allow All:true:false",
      listed.modes.map(t => [t.id, t.name, t.unrestricted, t.readOnly].join(":")).join(","));
    Assert.areEqual("build", listed.defaultMode);
  }

  @TestMethod
  public async listsModelsWithThePersonsMcpServersAndPluginsOff(): Promise<void> {
    await using host = new OpencodeTestHost();
    const config = host.directory.resolve("person", ".config", "opencode");
    mkdirSync(config, { recursive: true });
    writeFileSync(join(config, "opencode.json"), JSON.stringify({ mcp: { docs: { type: "local", command: ["docs"] } } }));
    const starter = new WatchingProcessStarter(() => undefined);
    const docs = (environment: NodeJS.ProcessEnv): string => {
      const config: unknown = JSON.parse(environment[Resources.opencodeConfigContentVariable] ?? "{}");
      const mcp = typeof config === "object" && !Object.isNull(config) && "mcp" in config ? config.mcp : null;
      return JSON.stringify(typeof mcp === "object" && !Object.isNull(mcp) && "docs" in mcp ? mcp.docs : null);
    };

    await host.createAdapter({}, host.command, starter).listModels(host.provider);

    Assert.isTrue(starter.environments.length > 0);
    Assert.areEqual(starter.environments.map(() => `1 {"enabled":false}`).join(","),
      starter.environments.map(t => `${t["OPENCODE_PURE"]} ${docs(t)}`).join(","));
  }

  @TestMethod
  public offersEachModelTheVariantsItsVerboseListNamesThenDefaultWithTheFirstAsItsDefaultNoneWhereItNamesNoneAndTheSessionsLevelsWhereItIsntListed(): Promise<void> {
    return OpencodeAdapterTests.assertLevels({},
      "anthropic/claude-sonnet-4-5:high,low,default:default|opencode/beam-free:low,medium,high,xhigh,max,default:low|opencode/big-pickle::null");
  }

  @TestMethod
  public readsTheVariantsOfModelsListedPastOtherCommandsOutputCap(): Promise<void> {
    return OpencodeAdapterTests.assertLevels({ TEAMRUN_FAKE_OPENCODE_MODELS: "long" },
      "anthropic/claude-sonnet-4-5:high,low,default:default|opencode/beam-free:low,medium,high,xhigh,max,default:low|opencode/big-pickle::null");
  }

  @TestMethod
  public keepsTheSessionsLevelsForEveryModelWhenItsVerboseListCantStart(): Promise<void> {
    return OpencodeAdapterTests.assertLevels({},
      "anthropic/claude-sonnet-4-5:high,low,default:default|opencode/beam-free:high,low,default:default|opencode/big-pickle:high,low,default:default",
      host => {
        const inner = new NodeProcessStarter(host.terminator);
        return { start: (command, environment, directory) => inner.start(command.arguments.includes("--verbose")
          ? new ProcessCommand(host.directory.resolve("missing-opencode"), []) : command, environment, directory) };
      });
  }

  @TestMethod
  public keepsTheSessionsLevelsForEveryModelWhenItsVerboseListFails(): Promise<void> {
    return OpencodeAdapterTests.assertLevels({ TEAMRUN_FAKE_OPENCODE_MODELS: "fail" },
      "anthropic/claude-sonnet-4-5:high,low,default:default|opencode/beam-free:high,low,default:default|opencode/big-pickle:high,low,default:default");
  }

  @TestMethod
  @TestData("2.2.0", "OpenCode 2.2.0 isn't supported yet: TeamRun hasn't checked that it keeps the approval rules TeamRun sets. Install OpenCode 1.x with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1.")
  @TestData("1.18.30", "OpenCode 1.18.30 is too old for TeamRun, which works with OpenCode 1.18.31 and later 1.x versions. Update it with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1.")
  @TestData("0.15.10", "OpenCode 0.15.10 is too old for TeamRun, which works with OpenCode 1.18.31 and later 1.x versions. Update it with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1.")
  @TestData("1.18.31", null)
  @TestData("1.20.0-beta.1", null)
  public async refusesAVersionOutsideItsRangeWithTheReason(version: string, refusal: string | null): Promise<void> {
    await using host = new OpencodeTestHost();

    const check = await host.createAdapter({ TEAMRUN_FAKE_ACP_VERSION: version }).checkSignIn(host.provider);

    Assert.areEqual(Object.isNull(refusal) ? AuthStatus.LoggedIn : AuthStatus.Error, check.authStatus, check.error ?? "");
    Assert.areEqual(refusal, Object.isNull(refusal) ? null : check.error);
  }

  @TestMethod
  public async failsATurnWithTheTerminalSignInHintWhenOpencodeAsksForASignIn(): Promise<void> {
    await using host = new OpencodeTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" });

    const turn = await adapter.runTurn(host.request("methods"), new RecordingTurnListener(), new AbortController().signal);
    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(Resources.opencodeSignInHint, turn.error);
    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
    Assert.isTrue(Resources.opencodeSignInHint.includes("opencode auth login"));
  }

  @TestMethod
  public async isNeverAskedForATitleSinceItsSessionWouldStartThePersonsOwnServersAndPlugins(): Promise<void> {
    await using host = new OpencodeTestHost();

    Assert.isUndefined(host.createAdapter().askIsolated);
  }

  @TestMethod
  public async runsPlanAndAPlanFirstTurnThroughItsModeOptionWithEditsDeniedAndAllowAllInBuildWithEverythingAllowedAtLaunch(): Promise<void> {
    await using host = new OpencodeTestHost();
    const adapter = host.createAdapter();
    const results: string[] = [];

    const planFirst = (request: TurnRequest): TurnRequest => request.withRequested(request.requested.withPlanFirst(true));
    for (const [mode, plans] of [[Resources.opencodePlanMode, false], [Resources.opencodeAllowAllMode, false], [Resources.opencodeBuildMode, false], [null, false],
      [Resources.opencodeAllowAllMode, true]] as const) {
      const ask = (prompt: string): TurnRequest => plans ? planFirst(host.request(prompt, mode)) : host.request(prompt, mode);
      const listener = new RecordingTurnListener();
      Assert.areEqual(TurnOutcome.Completed, (await adapter.runTurn(ask("methods"), listener, new AbortController().signal)).outcome, String(mode));
      const sets = (JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly sets: readonly string[] }).sets.join(",");
      const environment = new RecordingTurnListener();
      Assert.areEqual(TurnOutcome.Completed, (await adapter.runTurn(ask("opencode-environment"), environment, new AbortController().signal)).outcome);
      const content = JSON.parse((JSON.parse(environment.texts.find(t => t.startsWith("{\"HOME\""))!) as Record<string, string>)["OPENCODE_CONFIG_CONTENT"]!) as
        { readonly agent: Record<string, { readonly permission: Record<string, string> }> };
      const permission = content.agent["build"]!.permission;
      results.push(`${String(mode)}${plans ? " planning first" : ""}:${sets}:${permission["edit"]}:${permission["bash"]}`);
    }

    Assert.areEqual(["plan:mode=plan:deny:ask", "allowAll::allow:allow", "build::ask:ask", "null::ask:ask",
      "allowAll planning first:mode=plan:deny:ask"].join("|"), results.join("|"));
    Assert.areEqual(Resources.opencodePlanMode, adapter.planMode);
  }

  @TestMethod
  public async runsInThePersonsOwnSetupAndWritesNothingIntoTheirFolders(): Promise<void> {
    await using host = new OpencodeTestHost();
    writeFileSync(host.directory.resolve("chat", "AGENTS.md"), "Reply briefly.");
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ ANTHROPIC_API_KEY: "fixture" }).runTurn(new TurnRequest(null, host.directory.resolve("chat"), "opencode-environment",
      new RequestedSettings("opencode", null, null, null, null), null, []), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const seen = JSON.parse(listener.texts.find(t => t.startsWith("{\"HOME\""))!) as Record<string, string | null>;
    Assert.areEqual([host.directory.resolve("person"), host.directory.resolve("person"), host.directory.resolve("person-data"), host.directory.resolve("person", ".config"),
      "fixture"].join("|"), [seen["HOME"], seen["USERPROFILE"], seen["XDG_DATA_HOME"], seen["XDG_CONFIG_HOME"], seen["ANTHROPIC_API_KEY"]].join("|"));
    Assert.isNull(seen["XDG_CACHE_HOME"]);
    Assert.isNull(seen["XDG_STATE_HOME"]);
    Assert.isNull(seen["OPENCODE_DISABLE_PROJECT_CONFIG"]);
    Assert.isNull(seen["OPENCODE_DISABLE_CLAUDE_CODE"]);
    Assert.isNull(seen["OPENCODE_DISABLE_CLAUDE_CODE_PROMPT"]);
    Assert.isNull(seen["OPENCODE_PURE"]);
    Assert.isFalse(seen["OPENCODE_CONFIG_CONTENT"]!.includes("AGENTS.md"), seen["OPENCODE_CONFIG_CONTENT"]!);
    Assert.isFalse(existsSync(host.directory.resolve("person-data", Resources.profileMarker)));
    Assert.isFalse(existsSync(host.directory.resolve("person-data", "config")));
    Assert.isFalse(existsSync(host.directory.resolve("default-profile")));
  }

  @TestMethod
  public async keepsTheInstructionFilesThePersonsOwnConfigNamesInAChatTurn(): Promise<void> {
    await using host = new OpencodeTestHost();
    const folder = host.directory.resolve("person-config");
    mkdirSync(folder);
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ OPENCODE_CONFIG_DIR: folder, OPENCODE_CONFIG_CONTENT: JSON.stringify({ instructions: ["TEAM.md"] }) })
      .runTurn(new TurnRequest(null, host.directory.resolve("chat"), "opencode-environment", new RequestedSettings("opencode", null, null, null, null), null, []), listener,
        new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const seen = JSON.parse(listener.texts.find(t => t.startsWith("{\"HOME\"")) ?? "{}") as Record<string, string | null>;
    Assert.areEqual(folder, seen["OPENCODE_CONFIG_DIR"]);
    Assert.areEqual(JSON.stringify(["TEAM.md"]), JSON.stringify((JSON.parse(seen["OPENCODE_CONFIG_CONTENT"] ?? "{}") as { instructions?: unknown }).instructions));
  }

  @TestMethod
  public async runsAnAddedProvidersFolderWithItsOwnSignInAndSaysToInstallOpencodeWhenItIsMissing(): Promise<void> {
    await using host = new OpencodeTestHost();
    const listener = new RecordingTurnListener();
    const missing = host.createAdapter({}, null);

    await host.createAdapter({ ANTHROPIC_API_KEY: "fixture" }).runTurn(host.request("opencode-environment"), listener, new AbortController().signal);
    const turn = await missing.runTurn(host.request("hello"), new RecordingTurnListener(), new AbortController().signal);
    const check = await missing.checkSignIn(host.provider);
    const models = await Assert.throwsAsync(() => missing.listModels(host.provider), Error);

    const seen = JSON.parse(listener.texts.find(t => t.startsWith("{\"HOME\""))!) as Record<string, string | null>;
    Assert.areEqual(host.provider.profileDir, seen["XDG_DATA_HOME"]);
    Assert.isNull(seen["ANTHROPIC_API_KEY"]);
    Assert.areEqual(Resources.opencodeNotFound, turn.error);
    Assert.areEqual(`${AuthStatus.Error}:${Resources.opencodeNotFound}`, `${check.authStatus}:${check.error}`);
    Assert.areEqual(Resources.opencodeNotFound, models.message);
    Assert.isTrue(Resources.opencodeNotFound.includes("curl -fsSL https://opencode.ai/install | bash"));
  }

  @TestMethod
  public async sendsImagesInlineAndOtherFilesAsResourceLinksAndResumesThroughALoadThatReplays(): Promise<void> {
    await using host = new OpencodeTestHost();
    const image = host.directory.resolve("image.png");
    const notes = host.directory.resolve("notes.txt");
    writeFileSync(image, "fixture-image");
    writeFileSync(notes, "fixture-notes");
    const adapter = host.createAdapter();
    const files = new RecordingTurnListener();
    const resumed = new RecordingTurnListener();

    await adapter.runTurn(host.request("files", null, null, [new MessageAttachment("image.png", "image/png", 13, image),
      new MessageAttachment("notes.txt", "text/plain", 13, notes)]), files, new AbortController().signal);
    const turn = await adapter.runTurn(host.request("methods", null, "earlier"), resumed, new AbortController().signal);

    const parts = JSON.parse(files.texts.find(t => t.startsWith("[{"))!) as Record<string, unknown>[];
    Assert.areEqual("text,image,resource_link", parts.map(t => t["type"]).join(","));
    Assert.areEqual(pathToFileURL(notes).href, parts[2]?.["uri"]);
    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual("earlier", turn.nativeSessionId);
    const methods = (JSON.parse(resumed.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[] }).methods;
    Assert.isTrue(methods.includes("session/load"), methods.join(","));
    Assert.isFalse(methods.includes("session/resume"), methods.join(","));
    Assert.isFalse(resumed.texts.includes("replayed history"));
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new OpencodeTestHost();
    const adapter = host.createAdapter();
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => host.request(prompt, null, resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, host.provider, () => adapter.listModels(host.provider)),
      ...turns.probes({ [ProviderAbility.Questions]: TurnAbilityProbes.plain, [ProviderAbility.PlanChecklist]: TurnAbilityProbes.plain,
        [ProviderAbility.ReplyUsage]: "cost", [ProviderAbility.SubAgentRows]: TurnAbilityProbes.plain, [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: "generated-image", [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents(TurnAbilityProbes.plain),
      [ProviderAbility.ApprovedTools]: async () => (await turns.approvedTurnAsync("opencode-environment")).listener.texts
        .some(t => t.includes(TurnAbilityProbes.approvedTool))
    });
  }

  @TestMethod
  public async sendsOpencodeThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new OpencodeTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }

  private static async assertLevels(environment: NodeJS.ProcessEnv, expected: string,
    starter: (host: OpencodeTestHost) => Pick<IProcessStarter, "start"> = host => new NodeProcessStarter(host.terminator)): Promise<void> {
    await using host = new OpencodeTestHost();

    const listed = await host.createAdapter(environment, host.command, starter(host)).listModels(host.provider);

    Assert.areEqual(expected, listed.models.map(t => [t.id, t.effortLevels?.join(","), String(t.defaultEffort)].join(":")).join("|"));
  }
}
