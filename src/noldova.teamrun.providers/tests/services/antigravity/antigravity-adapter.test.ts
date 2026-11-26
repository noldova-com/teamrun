/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForkRequest, Resources as CoreResources, SharedMcpValues, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { AuthStatus, Provider, ProviderAbility, ProviderModel, RequestedSettings, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { type AcpAdapter, AntigravityAdapter, AntigravityAgent, AntigravityInstallation, AntigravityInstaller, AntigravityProfile, AntigravityServer, CommandRunner,
  ExecutableSource, type IProcessStarter, ProcessCommand, ProviderAbilityTable, type ProviderTimings, Resources,
  UnsupportedVersionException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { AntigravitySessionModesRecording } from "../../fixtures/antigravity-session-modes.recording.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RunningProgramsStarter } from "../../fixtures/running-programs-starter.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

const model = { id: "model", name: "Model", category: "model", type: "select", currentValue: "gemini-fast", options: [
  { group: "gemini", name: "Gemini", options: [{ value: "gemini-fast", name: "Gemini Fast" }, { value: "gemini-pro", name: "Gemini Pro" }] },
  { group: "partners", name: "Partners", options: [{ value: "partner-large", name: "Partner Large" }] }
] };
const platforms = [Resources.windowsPlatform, Resources.linuxPlatform, Resources.macPlatform];
const [, mode] = AntigravitySessionModesRecording.sessionNew.configOptions;

class ServerOnPath {
  public readonly version: string;
  public readonly installed: boolean;

  public constructor(version: string, installed: boolean) {
    this.version = version;
    this.installed = installed;
  }
}

@TestClass
export class AntigravityAdapterTests {
  @TestMethod
  public async checksAFoundFolderFromItsTokenFileAndAnAgentThatCantTellWithoutStartingAsNotChecked(): Promise<void> {
    await using host = new GrokTestHost();
    const signedIn = host.directory.resolve("signed-in");
    mkdirSync(join(signedIn, "antigravity-acp"), { recursive: true });
    writeFileSync(join(signedIn, "antigravity-acp", "acp_token.json"), "");
    const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
      new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
    const adapter = new AntigravityAdapter(() => new AntigravityServer(host.command, host.directory.resolve("harness")), installer, process.platform, host.environment,
      host.directory.resolve("default"), host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer);
    const providerOf = (kind: string, folder: string): Provider => new Provider("a1", kind, "Work", folder, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");

    const checks = [await adapter.checkFoundSignIn(providerOf("antigravity", signedIn)),
      await adapter.checkFoundSignIn(providerOf("antigravity", host.directory.resolve("signed-out"))),
      await host.createAdapter().checkFoundSignIn(providerOf("grok", host.directory.resolve("grok")))];

    Assert.areEqual(`${AuthStatus.LoggedIn} null,${AuthStatus.LoggedOut} null,${AuthStatus.Unknown} null`, checks.map(t => `${t.authStatus} ${t.identity}`).join(","));
    Assert.areEqual(0, host.programs.started.length);
  }

  @TestMethod
  public passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", (adapter, host, provider) => AcpCommandCheck.passesOnlyListedCommandsAsync(adapter,
      AntigravityAdapterTests.request(host, provider, "unused"), host.directory.path), {}, process.platform, undefined, t => t.timings,
      t => AcpCommandCheck.environment(t.directory.path));
  }

  @TestMethod
  public takesNoSharedServerSinceAntigravityKeepsTheirValuesInItsConversationFiles(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", adapter => {
      const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
      const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

      const kept = JSON.stringify({
        reason: "Antigravity keeps a session's MCP servers, with their values, in its conversation files, so TeamRun passes it no shared MCP servers.",
        short: "would keep it in its files"
      });
      Assert.areEqual(kept, JSON.stringify(adapter.sharedServerUnavailable(stdio)));
      Assert.areEqual(kept, JSON.stringify(adapter.sharedServerUnavailable(http)));
      return Promise.resolve();
    });
  }

  @TestMethod
  public sendsThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();
      const base = AntigravityAdapterTests.request(host, provider, "role-payload");

      const turn = await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested, base.resumeNativeSessionId, [],
        CoreResources.formatTeammateInstructions("Review carefully", null)), listener, new AbortController().signal);

      const payload = listener.texts.join("\n");
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
      Assert.isTrue(payload.includes(CoreResources.planToolInstructions) && payload.includes("Review carefully"), payload);
    });
  }

  @TestMethod
  public sendsThePersonsAndTheProjectsInstructionFilesWithTheTurnSinceAntigravityReadsNone(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const gemini = host.directory.resolve("person", ".gemini");
      mkdirSync(join(gemini, "config", "rules"), { recursive: true });
      writeFileSync(join(gemini, "AGENTS.md"), "person-agents-fixture");
      writeFileSync(join(gemini, "GEMINI.md"), "person-gemini-fixture");
      writeFileSync(join(gemini, "config", "rules", "a.md"), "person-rule-fixture");
      const request = AntigravityAdapterTests.request(host, provider, "role-payload");
      mkdirSync(request.workingDirectory, { recursive: true });
      writeFileSync(join(request.workingDirectory, "GEMINI.md"), "project-gemini-fixture");
      const listener = new RecordingTurnListener();

      const turn = await adapter.runTurn(request, listener, new AbortController().signal);

      const payload = listener.texts.join("\n");
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
      Assert.areEqual(JSON.stringify([true, true, true, true]), JSON.stringify(["person-agents-fixture", "person-rule-fixture", "person-gemini-fixture", "project-gemini-fixture"]
        .map(t => payload.includes(t))),
        payload);
      Assert.isFalse(existsSync(host.directory.resolve("profile", "GEMINI.md")));
    });
  }

  @TestMethod
  public sendsNoneOfThePersonsOrTheProjectsInstructionFilesWithATitleSession(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const gemini = host.directory.resolve("person", ".gemini");
      mkdirSync(join(gemini, "config", "rules"), { recursive: true });
      writeFileSync(join(gemini, "AGENTS.md"), "person-agents-fixture");
      writeFileSync(join(gemini, "GEMINI.md"), "person-gemini-fixture");
      writeFileSync(join(gemini, "config", "rules", "a.md"), "person-rule-fixture");
      const base = AntigravityAdapterTests.request(host, provider, "role-payload");
      mkdirSync(base.workingDirectory, { recursive: true });
      writeFileSync(join(base.workingDirectory, "GEMINI.md"), "project-gemini-fixture");
      const request = new TurnRequest(provider, base.workingDirectory, base.prompt, base.requested, null, [], null, null, {}, false, null, [], null, undefined,
        SharedMcpValues.none, null, true);

      const answer = await TitleAsks.answerAsync(adapter, request);

      Assert.isTrue(answer.includes("role-payload"), answer);
      Assert.areEqual(JSON.stringify([false, false, false, false]), JSON.stringify(["person-agents-fixture", "person-rule-fixture", "person-gemini-fixture",
        "project-gemini-fixture"].map(t => answer.includes(t))), answer);
    });
  }

  @TestMethod
  public async notesALinkIntoTheProfileThatFailsInTheAdaptersLog(): Promise<void> {
    await using host = new GrokTestHost();
    const profile = host.directory.resolve("profile");
    mkdirSync(join(profile, "antigravity-acp"), { recursive: true });
    writeFileSync(join(profile, ".teamrun-managed-profile"), Resources.antigravityProfileMarkerValue);
    writeFileSync(join(profile, "antigravity-acp", "acp_token.json"), "");
    mkdirSync(join(profile, "config", "skills", "own"), { recursive: true });
    mkdirSync(host.directory.resolve("person", ".gemini", "config", "skills"), { recursive: true });
    const log = new RecordingLog();
    const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
      new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
    const adapter = new AntigravityAdapter(() => new AntigravityServer(host.command, host.directory.resolve("harness")), installer, process.platform, host.environment,
      host.directory.resolve("default"), host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer, log);
    const provider = new Provider("a1", "antigravity", "Work", profile, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    try {
      await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "role-payload"), new RecordingTurnListener(), new AbortController().signal);

      Assert.isTrue(log.lines.includes(Resources.formatAntigravityNotLinked(join(profile, "config", "skills"),
        host.directory.resolve("person", ".gemini", "config", "skills"), Resources.antigravityNotALink)), log.lines.join(" | "));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public refusesAForkWithTheWordingEveryProviderWithoutOneShares(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const refused = await Assert.throwsAsync(() => adapter.forkSession(new ForkRequest(provider, host.directory.path, "s-1", "0",
        new RequestedSettings("antigravity", null, null))), Error);

      Assert.isFalse(adapter.descriptor.supportsFork);
      Assert.areEqual("Antigravity can't fork a session; a rewind goes on in a fresh session that is told what was said before.", refused.message);
    });
  }

  @TestMethod
  public runsATurnInTheProvidersProfileWithAGroupedModelAndResumesIt(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "methods", null, "partner-large"), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("partner-large", result.observed.model);
      Assert.isNull(result.observed.effort);
      Assert.areEqual("1.3.0", result.observed.harnessVersion);
      const sent = AntigravityAdapterTests.echoed(listener);
      Assert.areEqual("initialize,authenticate,session/new,session/set_config_option,session/prompt", sent.readStringArray("methods").join(","));
      Assert.areEqual(JSON.stringify({ methodId: "oauth-personal" }), JSON.stringify(sent.readObject("authenticated").toJson()));
      const again = new RecordingTurnListener();
      const resumed = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "methods", "old-session"), again, new AbortController().signal);
      Assert.areEqual("old-session", resumed.nativeSessionId);
      Assert.isTrue(again.starts[0]?.resumedNativeSession ?? false);
      const effort = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete", null, null, "high"), new RecordingTurnListener(),
        new AbortController().signal);
      Assert.areEqual(TurnOutcome.Failed, effort.outcome);
      Assert.areEqual(Resources.formatUnknownEffort("high", "Gemini Fast"), effort.error);
    });
  }

  @TestMethod
  public listsTheModesItsLiveSessionOffersWithTheOneItStartsInAsTheDefaultAndTheOneThatApprovesAllToolsAsUnrestricted(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, _host, provider) => {
      const listed = await adapter.listModels(provider);

      const recorded = AntigravitySessionModesRecording.sessionNew.modes;
      Assert.areEqual(recorded.availableModes.map(t => `${t.id}:${t.name}`).join(","), listed.modes.map(t => `${t.id}:${t.name}`).join(","));
      Assert.areEqual(mode.options.map(t => t.value).join(","), listed.modes.map(t => t.id).join(","));
      Assert.areEqual(recorded.currentModeId, listed.defaultMode);
      Assert.areEqual(recorded.availableModes.filter(t => t.description === "Auto-approve all tools").map(t => t.id).join(","),
        listed.modes.filter(t => t.unrestricted).map(t => t.id).join(","));
    });
  }

  @TestMethod
  public listsItsModesAtDefaultAndRunsAChosenOneThroughItsModeOption(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listed = await adapter.listModels(provider);
      const sets: string[] = [];
      for (const chosen of ["auto_edit", "yolo", "default", null]) {
        const listener = new RecordingTurnListener();
        const turn = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "methods", null, null, null, false, chosen), listener,
          new AbortController().signal);
        Assert.areEqual(TurnOutcome.Completed, turn.outcome, String(chosen));
        sets.push(AntigravityAdapterTests.echoed(listener).readStringArray("sets").join(","));
      }

      Assert.areEqual("default:Default:false,auto_edit:Auto Edit:false,yolo:YOLO:true", listed.modes.map(t => [t.id, t.name, t.unrestricted].join(":")).join(","));
      Assert.areEqual([Resources.antigravityDefaultModeDescription, Resources.antigravityAutoEditModeDescription, Resources.antigravityYoloModeDescription].join("|"),
        listed.modes.map(t => t.description).join("|"));
      Assert.areEqual("default", listed.defaultMode);
      Assert.areEqual("mode=auto_edit|mode=yolo||", sets.join("|"));
    });
  }

  @TestMethod
  public switchesASessionThatStartsInYoloToTheDefault(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();

      const turn = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "methods"), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, turn.outcome);
      Assert.areEqual("mode=default", AntigravityAdapterTests.echoed(listener).readStringArray("sets").join(","));
    }, { TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify([model, { ...mode, currentValue: "yolo" }]) });
  }

  @TestMethod
  public failsATurnBeforeItsPromptWhenItsSessionStartsInYoloWithoutTheDefault(): Promise<void> {
    const yolo = { ...mode, currentValue: "yolo", options: mode.options.filter(t => t.value !== "default") };
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();

      const turn = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "methods"), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, turn.outcome);
      Assert.areEqual(Resources.formatUnrestrictedMode("Antigravity", "YOLO"), turn.error);
      Assert.isFalse(listener.texts.some(t => t.startsWith("{\"methods\"")));
    }, { TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify([model, yolo]) });
  }

  @TestMethod
  public showsEachCompactionOnceWhetherReportedAsACompactionUpdateOrAsTheAgentsOwn(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "compact"), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify(["Before", "Antigravity compacted its context.", "After", "Antigravity compacted its context."]),
        JSON.stringify(listener.texts.filter(t => t === "Before" || t === "After" || t.includes("compacted"))));
    });
  }

  @TestMethod
  public saysItCantCompactInsteadOfSendingCompactToAResumedSession(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete", "old-session", null, null, true), listener,
        new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("old-session", result.nativeSessionId);
      Assert.isTrue(listener.texts.includes("Antigravity can't compact its context."));
      Assert.isFalse(listener.texts.includes("/compact"));
    });
  }

  @TestMethod
  public showsAntigravityAmongTheRunningProgramsWhileATurnRunsAndNotAfter(): Promise<void> {
    const starter = new RunningProgramsStarter();
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const controller = new AbortController();
      const listener = new RecordingTurnListener();

      const run = adapter.runTurn(AntigravityAdapterTests.request(host, provider, "cancel"), listener, controller.signal);
      await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
      const during = starter.ofKind("antigravity").length;
      controller.abort();

      Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
      Assert.areEqual(1, during);
      Assert.areEqual(0, starter.running.length);
    }, {}, process.platform, starter);
  }

  @TestMethod
  public signsOutWithAcpsLogoutWhichThePinnedServerOffersAfterStoppingTheProvidersTurn(): Promise<void> {
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true, audio: true, embeddedContext: true },
      mcpCapabilities: { http: true, sse: true }, sessionCapabilities: { list: {}, resume: {} }, auth: { logout: {} } },
    authMethods: [{ id: "oauth-personal", name: "Google" }], agentInfo: { name: "antigravity-acp", title: "Google Antigravity", version: "1.3.0" } };
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const listener = new RecordingTurnListener();

      const running = adapter.runTurn(AntigravityAdapterTests.request(host, provider, "cancel"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
      await adapter.signOut(provider);
      const received = JsonReader.parse(readFileSync(join(provider.profileDir, "logout.txt"), "utf8"));
      const result = await running;

      Assert.areEqual(`${TurnOutcome.Failed} ${Resources.formatTurnStoppedForSignOut("Antigravity")}`, `${result.outcome} ${result.error}`);
      Assert.isFalse(existsSync(join(provider.profileDir, ...Resources.antigravityTokenSegments)));
      Assert.isTrue(existsSync(join(provider.profileDir, Resources.profileMarker)));
      Assert.areEqual("initialize,logout", received.readStringArray("methods").join(","));
      await host.programs.endedAt(host.programs.started.length);
      Assert.areEqual(host.programs.started.length, host.programs.ended.length);
    }, { TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) });
  }

  @TestMethod
  public failsSigningOutOfAServerThatDoesntOfferAcpsLogout(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, _host, provider) => {
      const refused = await Assert.throwsAsync(() => adapter.signOut(provider), Error);

      Assert.areEqual("Antigravity 1.3.0 doesn't support signing out: its ACP server doesn't offer ACP's logout.", refused.message);
      Assert.isFalse(existsSync(join(provider.profileDir, "logout.txt")));
      Assert.isTrue(existsSync(join(provider.profileDir, ...Resources.antigravityTokenSegments)));
    });
  }

  @TestMethod
  public async countsACompatibleServerOnPathAsInstalledAndSaysWhyAnotherDoesNotCount(): Promise<void> {
    for (const { version, installed } of [new ServerOnPath("1.3.1", true), new ServerOnPath("1.4.0", false)]) {
      await using host = new GrokTestHost();
      const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
        new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
      const capabilities: JsonObject = { agentCapabilities: {}, authMethods: [], agentInfo: { name: "antigravity-acp", version } };
      const adapter = new AntigravityAdapter(() => new AntigravityServer(host.command, host.directory.resolve("harness"), ExecutableSource.Path), installer,
        process.platform, { ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) }, host.directory.resolve("default"),
        host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer);
      try {
        Assert.isFalse(adapter.installation.isInstalled, version);
        const versions = await adapter.installation.readVersions(true);
        const again = await adapter.installation.readVersions(true);

        Assert.areEqual(installed, adapter.installation.isInstalled, version);
        Assert.areEqual(installed ? version : null, versions.installed, version);
        Assert.areEqual(versions.installed, again.installed, version);
        Assert.areEqual(1, host.programs.started.length, version);
        Assert.areEqual(installed ? host.command.executable : null, adapter.installation.foundPath ?? null, version);
        Assert.areEqual(installed ? null : Resources.formatAntigravityPathUnsupported(host.command.executable, version),
          adapter.installation.notInstalledReason ?? null, version);
      }
      finally {
        await adapter.shutdown();
      }
    }
  }

  @TestMethod
  public startsASignedOutProvidersChosenServerToCheckItsVersionAndNoOtherSignedOutOne(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.4.1", async (adapter, host) => {
      const fresh = (folder: string, binaryPath: string | null): Provider => new Provider("a2", "antigravity", "Fresh", host.directory.resolve(folder),
        AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z", true, false, binaryPath);
      const unchosen = await adapter.checkSignIn(fresh("unchosen", null));
      Assert.areEqual(`${AuthStatus.LoggedOut} 0`, `${unchosen.authStatus} ${host.programs.started.length}`);
      const chosen = await adapter.checkSignIn(fresh("chosen", "/opt/agy/agy_acp_server"));

      Assert.areEqual(AuthStatus.Error, chosen.authStatus);
      Assert.areEqual(Resources.formatAntigravityUnsupported("1.4.1"), chosen.error);
      Assert.areEqual(1, host.programs.started.length);
    });
  }

  @TestMethod
  public reportsASignedOutProvidersAcceptedChosenServerAsSignedOut(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host) => {
      const check = await adapter.checkSignIn(new Provider("a2", "antigravity", "Fresh", host.directory.resolve("chosen"), AuthStatus.Unknown, null, null, null,
        null, "2026-09-09T00:00:00.000Z", true, false, "/opt/agy/agy_acp_server"));

      Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
      Assert.areEqual(1, host.programs.started.length);
    });
  }

  @TestMethod
  public refusesAServerOtherThanThePinnedVersion(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.4.1", async (adapter, host, provider) => {
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);
      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.areEqual(Resources.formatAntigravityUnsupported("1.4.1"), result.error);
    });
  }

  @TestMethod
  public refusesToSignInWithAServerOtherThanThePinnedVersion(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.4.1", async (adapter, _host, provider) => {
      const refused = await Assert.throwsAsync(() => adapter.signIn(provider, new AbortController().signal), UnsupportedVersionException);

      Assert.areEqual(Resources.formatAntigravityUnsupported("1.4.1"), refused.message);
    });
  }

  @TestMethod
  public async listsTheModelsTheProvidersLastFreshTurnNamedWithNoEffortAndAwaitsATurnBeforeTheFirstOnEveryPlatform(): Promise<void> {
    for (const platform of platforms) {
      await AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
        const before = await adapter.listModels(provider);

        Assert.areEqual(0, host.programs.started.length, platform);
        Assert.areEqual(0, before.models.length, platform);
        Assert.areEqual(true, before.signedIn, platform);
        Assert.areEqual(true, before.awaitsTurn, platform);
        Assert.areEqual(false, before.empty, platform);
      }, {}, platform);
    }
    await AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const empty = new Provider("a2", "antigravity", "Home", host.directory.resolve("empty"), AuthStatus.Unknown, null, null, null, null,
        "2026-09-09T00:00:00.000Z");

      const turn = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete", null, "gemini-pro"), new RecordingTurnListener(),
        new AbortController().signal);
      const after = await adapter.listModels(provider);
      const signedOut = await adapter.listModels(empty);

      Assert.areEqual(TurnOutcome.Completed, turn.outcome);
      Assert.areEqual("gemini-fast,gemini-pro,partner-large", after.models.map(t => t.id).join(","));
      Assert.areEqual("Gemini Fast,Gemini Pro,Partner Large", after.models.map(t => t.displayName).join(","));
      Assert.areEqual("gemini-fast", after.models.filter(t => t.isDefault).map(t => t.id).join(","));
      Assert.isTrue(after.models.every(t => t.effortLevels?.length === 0 && t.supportsImages === true));
      Assert.areEqual(true, after.signedIn);
      Assert.areEqual(false, after.awaitsTurn);
      Assert.areEqual(0, signedOut.models.length);
      Assert.areEqual(false, signedOut.signedIn);
      Assert.areEqual(false, signedOut.awaitsTurn);
    }, {}, Resources.windowsPlatform);
  }

  @TestMethod
  public keepsNoModelsFromAResumedSession(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const resumed = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete", "old-session"), new RecordingTurnListener(),
        new AbortController().signal);
      const listed = await adapter.listModels(provider);

      Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
      Assert.areEqual("old-session", resumed.nativeSessionId);
      Assert.areEqual(0, listed.models.length);
      Assert.areEqual(true, listed.awaitsTurn);
    });
  }

  @TestMethod
  public completesATurnWhoseModelsCantBeKeptAndStillAwaitsOne(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      mkdirSync(join(provider.profileDir, ".teamrun-models.json"));

      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);
      const listed = await adapter.listModels(provider);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.isNull(result.error);
      Assert.areEqual(true, listed.awaitsTurn);
    });
  }

  @TestMethod
  public sendsTheModelChosenFromTheListWithTheTurnAndOffersNoEffortForIt(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);
      const listed = await adapter.listModels(provider);
      const chosen = listed.models.find(t => t.id === "gemini-pro");
      Assert.isDefined(chosen);

      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete", null, chosen.id), new RecordingTurnListener(),
        new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("gemini-pro", result.observed.model);
      Assert.isNull(result.observed.effort);
      Assert.areEqual(0, chosen.effortLevels?.length);
    }, {}, Resources.macPlatform);
  }

  @TestMethod
  public async listsWithoutStartingTheServerOnAnyPlatformAndChecksTheSignInWithNoAuthenticateWhenASignInWouldHang(): Promise<void> {
    for (const platform of platforms) {
      await AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
        new AntigravityProfile(provider.profileDir, host.directory.resolve("tmp")).keepModels([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)]);

        const listed = await adapter.listModels(provider);

        Assert.areEqual("gemini-pro", listed.models.map(t => t.id).join(","), platform);
        Assert.areEqual(true, listed.signedIn, platform);
        Assert.areEqual(0, host.programs.started.length, platform);
      }, { TEAMRUN_FAKE_ACP_SIGNIN_HANG: "1", BROWSER: "firefox" }, platform);
    }
    await AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const checked = await adapter.checkSignIn(provider);

      Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
      Assert.isNull(checked.error);
      Assert.areEqual("1.3.0", checked.harnessVersion);
      Assert.isFalse(existsSync(join(provider.profileDir, "auth-browser.txt")));
      Assert.isTrue(host.programs.started.length > 0);
      await host.programs.endedAt(host.programs.started.length);
      Assert.areEqual(host.programs.started.length, host.programs.ended.length);
    }, { TEAMRUN_FAKE_ACP_SIGNIN_HANG: "1", BROWSER: "firefox" }, Resources.linuxPlatform, undefined, t => t.hangingSignInTimings);
  }

  @TestMethod
  public leavesATurnsSignInTheDefaultBrowser(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("", readFileSync(join(provider.profileDir, "auth-browser.txt"), "utf8"));
    }, { TEAMRUN_FAKE_ACP_RECORD_BROWSER: "1", BROWSER: "firefox" }, Resources.macPlatform);
  }

  @TestMethod
  public signsInWithThePersonsBrowserAndXAuthorityWhichItsTurnsLeaveOut(): Promise<void> {
    const starter = new WatchingProcessStarter(() => undefined);
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      await adapter.signIn(provider, new AbortController().signal);
      const signingIn = starter.environments.at(-1);
      await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);
      const turn = starter.environments.at(-1);

      Assert.areEqual("firefox /run/user/1000/xauth", `${signingIn?.["BROWSER"]} ${signingIn?.["XAUTHORITY"]}`);
      Assert.areEqual("undefined undefined", `${turn?.["BROWSER"]} ${turn?.["XAUTHORITY"]}`);
    }, { BROWSER: "firefox", XAUTHORITY: "/run/user/1000/xauth" }, Resources.linuxPlatform, starter);
  }

  @TestMethod
  public failsATurnWhoseSignInHangsInTheDefaultBrowserAndLeavesNothingRunning(): Promise<void> {
    return AntigravityAdapterTests.withAdapter("1.3.0", async (adapter, host, provider) => {
      const result = await adapter.runTurn(AntigravityAdapterTests.request(host, provider, "complete"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.areEqual("", readFileSync(join(provider.profileDir, "auth-browser.txt"), "utf8"));
      Assert.isTrue(host.programs.started.length > 0);
      await host.programs.endedAt(host.programs.started.length);
      Assert.areEqual(host.programs.started.length, host.programs.ended.length);
    }, { TEAMRUN_FAKE_ACP_SIGNIN_HANG: "1", BROWSER: "firefox" }, Resources.macPlatform, undefined, t => t.hangingSignInTimings);
  }

  @TestMethod
  public async failsATurnWhenTheServerIsNotInstalled(): Promise<void> {
    await using host = new GrokTestHost();
    const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
      new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
    const adapter = new AntigravityAdapter(() => null, installer, process.platform, host.environment, host.directory.resolve("default"),
      host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer);
    try {
      Assert.areEqual("antigravity", adapter.descriptor.id);
      Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.antigravity);
      Assert.isInstanceOf(adapter.installation, AntigravityInstallation);
      Assert.isFalse(adapter.installation.isInstalled);
      Assert.isNull(adapter.installation.foundPath ?? null);
      const result = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);
      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.areEqual(Resources.antigravityNotFound, result.error);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async offersNoListOfItsOwnMcpServersAndStartsNothingToSaySo(): Promise<void> {
    await using host = new GrokTestHost();
    const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
      new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
    const adapter = new AntigravityAdapter(() => null, installer, process.platform, host.environment, host.directory.resolve("default"),
      host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer);
    try {
      Assert.isNull(await adapter.listOwnMcpServers(null));
      Assert.areEqual(0, host.programs.started.length);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new GrokTestHost();
    const profile = host.directory.resolve("profile");
    mkdirSync(join(profile, "antigravity-acp"), { recursive: true });
    writeFileSync(join(profile, ".teamrun-managed-profile"), Resources.antigravityProfileMarkerValue);
    writeFileSync(join(profile, "antigravity-acp", "acp_token.json"), "");
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true }, mcpCapabilities: { http: true }, sessionCapabilities: { resume: {} } },
      authMethods: [{ id: "oauth-personal", name: "Google" }], agentInfo: { name: "antigravity-acp", version: "1.3.0" } };
    const levels = { ...model, options: [...model.options, { group: "flash", name: "Flash", options: [{ value: "flash-low", name: "Low" }, { value: "flash-high", name: "High" }] }] };
    const installer = new AntigravityInstaller(null, host.directory.resolve("providers"), null, process.platform, process.arch,
      new ProcessCommand("/usr/bin/codesign", []), new CommandRunner(host.starter), 1000, 1000);
    const adapter = new AntigravityAdapter(() => new AntigravityServer(host.command, host.directory.resolve("harness")), installer, process.platform,
      { ...host.environment, TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify([levels, mode]), TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) },
      host.directory.resolve("default"), host.directory.resolve("tmp"), host.info, host.programs.wrap(host.starter), host.timings, host.timer);
    const provider = new Provider("a1", "antigravity", "Work", profile, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(provider, host.directory.path, prompt,
      new RequestedSettings("antigravity", null, null), resume, attachments), host.directory.path);

    try {
      await AbilityChecks.runAsync(adapter.descriptor, {
        ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
        ...turns.probes({ [ProviderAbility.Questions]: "antigravity-question", [ProviderAbility.PlanChecklist]: TurnAbilityProbes.plain,
          [ProviderAbility.ReplyUsage]: "usage", [ProviderAbility.SubAgentRows]: "antigravity-sub-agent", [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
          [ProviderAbility.GeneratedImages]: "generated-image", [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
        ...turns.subAgents("antigravity-sub-agent"),
        [ProviderAbility.ApprovedTools]: () => turns.runsApprovedToolAsync({ title: TurnAbilityProbes.approvedTool,
          _meta: { mcp: { server: "teamrun", tool: TurnAbilityProbes.approvedTool } } }, true)
      });
    }
    finally {
      await adapter.shutdown();
    }
  }

  private static async withAdapter(version: string,
    test: (adapter: AcpAdapter, host: GrokTestHost, provider: Provider) => Promise<void>, extra: NodeJS.ProcessEnv = {},
    platform: string = process.platform, starter?: IProcessStarter, timings: (host: GrokTestHost) => ProviderTimings = t => t.timings,
    extraOf: (host: GrokTestHost) => NodeJS.ProcessEnv = () => ({})): Promise<void> {
    await using host = new GrokTestHost();
    const profile = host.directory.resolve("profile");
    const token = join(profile, "antigravity-acp", "acp_token.json");
    mkdirSync(dirname(token), { recursive: true });
    writeFileSync(join(profile, ".teamrun-managed-profile"), Resources.antigravityProfileMarkerValue);
    writeFileSync(token, "");
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true }, sessionCapabilities: { resume: {} } },
      authMethods: [{ id: "oauth-personal", name: "Google" }, { id: "gemini-api-key", name: "Gemini API key" }],
      agentInfo: { name: "antigravity-acp", version } };
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify([model, mode]), TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities),
      TEAMRUN_FAKE_ACP_REQUIRE_AUTH: "1", ...extra, ...extraOf(host) };
    const adapter = host.createAcpAdapter(new AntigravityAgent(() => new AntigravityServer(host.command, host.directory.resolve("harness")), platform, environment,
      host.directory.resolve("default"), host.directory.resolve("tmp")), starter, timings(host));
    const provider = new Provider("a1", "antigravity", "Work", profile, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    await test(adapter, host, provider);
  }

  private static request(host: GrokTestHost, provider: Provider, prompt: string, resume: string | null = null, model: string | null = null,
    effort: string | null = null, compacts: boolean = false, mode: string | null = null): TurnRequest {
    return new TurnRequest(provider, host.directory.path, prompt, new RequestedSettings("antigravity", model, effort, null, mode), resume, [], null, null, {}, compacts);
  }

  private static echoed(listener: RecordingTurnListener): JsonReader {
    const echoed = listener.texts.find(t => t.startsWith("{\"methods\""));
    if (Object.isUndefined(echoed))
      throw new Error("Antigravity was sent no prompt, so it echoed no methods.");
    return JsonReader.parse(echoed);
  }
}
