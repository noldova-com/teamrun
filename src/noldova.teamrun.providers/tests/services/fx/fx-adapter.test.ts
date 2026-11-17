/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForkRequest, McpEndpoint, SessionTokens, TimeoutException, TurnOutcome, TurnRequest, TurnTools } from "@noldova/teamrun.core";
import { AbilityAnswer, AbilitySource, AuthStatus, MessageAttachment, ProviderAbility, ProviderModel, RequestedSettings, SharedMcpServerDefinition,
  SharedMcpTransport } from "@noldova/teamrun.protocol";
import { ProviderAbilityTable, Resources, SignInException, SignOutException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { FxTestHost } from "../../fixtures/fx-test-host.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";

@TestClass
export class FxAdapterTests {
  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new FxTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter(AcpCommandCheck.environment(host.directory.path)), host.request("unused"), host.directory.path);
  }

  @TestMethod
  public async sendsThePromptWithoutWaitingForTeamRunsToolsAsItListsThemOnlyOnceThePromptArrives(): Promise<void> {
    await using host = new FxTestHost();
    const listener = new RecordingTurnListener();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "c1/t1"));
    const request = new TurnRequest(host.provider, host.directory.resolve("chat"), "complete", new RequestedSettings("fx", null, null), null, [], null, null, {},
      false, tools);

    const result = await host.createAdapter().runTurn(request, listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome, result.error ?? "no error");
    Assert.isFalse(host.timer.requested.includes(Resources.teamRunToolsWait), host.timer.requested.join(","));
    Assert.areEqual(0, listener.sharedFailures.length, JSON.stringify(listener.sharedFailures));
  }

  @TestMethod
  public async signsOutOfEachOfFxsAccountsWithFxLogout(): Promise<void> {
    await using host = new FxTestHost();

    await host.createAdapter().signOut(host.provider);

    Assert.areEqual("vercel\ncodex\ngrok\n", readFileSync(join(host.home, "logout-calls.txt"), "utf8"));
  }

  @TestMethod
  public async reportsAnFxLogoutThatFailsOrDoesntEnd(): Promise<void> {
    await using host = new FxTestHost();

    const failed = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_FX_LOGOUT: "fail" }).signOut(host.provider), SignOutException);
    const hung = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_FX_LOGOUT: "hang" }).signOut(host.provider), Error);
    const quiet = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_FX_LOGOUT: "quiet" }).signOut(host.provider), SignOutException);

    Assert.areEqual(Resources.fxAccounts.map(t => Resources.formatFxSignOutFailed(t, "fx logout: failed to durably remove saved fx login")).join(" "), failed.message);
    Assert.areEqual(Resources.fxAccounts.map(t => Resources.formatFxSignOutFailed(t, null)).join(" "), quiet.message);
    Assert.areEqual(Resources.fxAccounts.map(t => Resources.formatFxSignOutTimedOut(t, host.timings.signInCheckTimeout)).join(" "), hung.message);
    Assert.isInstanceOf(hung, TimeoutException);
    Assert.isFalse(failed instanceof TimeoutException || quiet instanceof TimeoutException);
    Assert.isFalse(existsSync(join(host.home, "logout-calls.txt")));
  }

  @TestMethod
  public async goesOnSigningOutOfFxsOtherAccountsWhenOneFailsAndReportsThatOne(): Promise<void> {
    await using host = new FxTestHost();

    const failed = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_FX_LOGOUT: "fail", TEAMRUN_FAKE_FX_LOGOUT_ACCOUNTS: "vercel" })
      .signOut(host.provider), Error);
    const hung = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_FX_LOGOUT: "hang", TEAMRUN_FAKE_FX_LOGOUT_ACCOUNTS: "codex" })
      .signOut(host.provider), Error);

    Assert.areEqual(Resources.formatFxSignOutFailed("vercel", "fx logout: failed to durably remove saved fx login"), failed.message);
    Assert.isFalse(failed instanceof TimeoutException);
    Assert.areEqual(Resources.formatFxSignOutTimedOut("codex", host.timings.signInCheckTimeout), hung.message);
    Assert.isInstanceOf(hung, TimeoutException);
    Assert.areEqual("codex\ngrok\nvercel\ngrok\n", readFileSync(join(host.home, "logout-calls.txt"), "utf8"));
  }

  @TestMethod
  public async describesATerminalSignInInItsHomeWithNoForkAndASignOut(): Promise<void> {
    await using host = new FxTestHost();
    const descriptor = host.createAdapter().descriptor;

    Assert.areEqual("fx:fx:true:true:false:false:true", [descriptor.id, descriptor.displayName, descriptor.supportsResume, descriptor.supportsSignInCheck,
      descriptor.supportsFork, descriptor.supportsSignIn, descriptor.supportsSignOut].join(":"));
    Assert.isTrue(descriptor.abilities === ProviderAbilityTable.fx);
    Assert.areEqual([Resources.fxSeveralAccountsAbility, Resources.fxChooseContextAbility, Resources.fxAccountAbility].map(t => `${AbilityAnswer.Cannot} ${t}`).join("|"),
      [ProviderAbility.SeveralAccounts, ProviderAbility.ChooseContext, ProviderAbility.Account].map(t => ProviderAbilityTable.fx.cellOf(t))
        .map(t => `${t.answer} ${t.detail}`).join("|"));
    Assert.areEqual(Resources.fxOneAccountPerComputer, descriptor.singleAccount);
    Assert.areEqual(`${descriptor.displayName} can't switch on its own MCP servers here: ${Resources.fxOwnServersSwitchAbility}.`, descriptor.ownMcpServersUnavailable);
    Assert.areEqual(JSON.stringify({ variable: "FX_HOME", signInCommand: "fx login", usualFolder: join(host.home, ".fx"), toolCommand: null,
      signInVariables: {}, signInValues: {}, personFolders: [join(host.home, ".fx")] }), JSON.stringify(descriptor.profile?.toJson()));
    const refused = await Assert.throwsAsync(() => host.createAdapter().signIn(host.provider, new AbortController().signal), SignInException);
    Assert.areEqual(Resources.fxSignInUnavailable, refused.message);
  }

  @TestMethod
  public async asksFxStatusWhetherItIsSignedInInTheProfileAndStartsNoAcpWhenItIsnt(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "missing", AI_GATEWAY_API_KEY: "fixture" });

    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(`${AuthStatus.LoggedOut}|${Resources.fxSignedOut}`, `${check.authStatus}|${check.error}`);
    Assert.isTrue(check.error!.includes("fx login"), check.error!);
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(JSON.stringify({ args: ["status", "--json"], key: null }), readFileSync(join(host.home, "status-call.json"), "utf8"));
    Assert.isFalse(existsSync(host.provider.profileDir));
  }

  @TestMethod
  public async goesOnThroughFxAcpWhenFxStatusSaysSignedInOrCantBeRead(): Promise<void> {
    await using host = new FxTestHost();

    const signedIn = await host.createAdapter().checkSignIn(host.provider);
    const started = host.programs.started.length;
    const unreadable = await host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "unreadable" }).checkSignIn(host.provider);

    Assert.areEqual(`${AuthStatus.LoggedIn}|0.0.16`, `${signedIn.authStatus}|${signedIn.harnessVersion}`, signedIn.error ?? "");
    Assert.areEqual(2, started);
    Assert.areEqual(`${AuthStatus.LoggedIn}|0.0.16`, `${unreadable.authStatus}|${unreadable.harnessVersion}`, unreadable.error ?? "");
  }

  @TestMethod
  public async checksAFoundFolderThroughFxStatusAloneAndNeverStartsFxAcp(): Promise<void> {
    await using host = new FxTestHost();

    const signedIn = await host.createAdapter().checkFoundSignIn(host.provider);
    const signedOut = await host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "missing" }).checkFoundSignIn(host.provider);
    const unreadable = await host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "unreadable" }).checkFoundSignIn(host.provider);

    Assert.areEqual(`${AuthStatus.LoggedIn} null|${AuthStatus.LoggedOut} ${Resources.fxSignedOut}|${AuthStatus.Unknown} null`,
      [signedIn, signedOut, unreadable].map(t => `${t.authStatus} ${t.error}`).join("|"));
    Assert.areEqual(3, host.programs.started.length);
    Assert.isFalse(existsSync(host.provider.profileDir));
  }

  @TestMethod
  public async saysFxWasntFoundWhenItCantAskFxStatus(): Promise<void> {
    await using host = new FxTestHost();

    const check = await host.createAdapter({}, null).checkSignIn(host.provider);

    Assert.areEqual(`${AuthStatus.Error}|${process.platform === "win32" ? Resources.fxWindowsNotFound : Resources.fxNotFound}`, `${check.authStatus}|${check.error}`);
  }

  @TestMethod
  public async readsInitializesRefusalAsSignedOutInTheCheckTheListingAndATurn(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" });
    const listener = new RecordingTurnListener();
    const signIn = Resources.fxSignedOut;

    const check = await adapter.checkSignIn(host.provider);
    const listed = await adapter.listModels(host.provider);
    const turn = await adapter.runTurn(host.request("hello"), listener, new AbortController().signal);

    Assert.areEqual(`${AuthStatus.LoggedOut}|${signIn}`, `${check.authStatus}|${check.error}`);
    Assert.areEqual("false|", `${listed.signedIn}|${listed.models.map(t => t.id).join(",")}`);
    Assert.areEqual(`${TurnOutcome.Failed}|${signIn}`, `${turn.outcome}|${turn.error}`);
  }

  @TestMethod
  public async keepsFxsWordsWhenItRefusesASignedInPersonsStartWithTheSameCode(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "credentialRefresh" });
    const listener = new RecordingTurnListener();
    const words = "Credential refresh is temporarily unavailable. Retry shortly.";

    const check = await adapter.checkSignIn(host.provider);
    const listing = await Assert.throwsAsync(() => adapter.listModels(host.provider), Error);
    const turn = await adapter.runTurn(host.request("hello"), listener, new AbortController().signal);

    Assert.areEqual(AuthStatus.Error, check.authStatus, check.error ?? "");
    Assert.isTrue((check.error ?? "").includes(words), check.error ?? "");
    Assert.isTrue(listing.message.includes(words), listing.message);
    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.isTrue((turn.error ?? "").includes(words), turn.error ?? "");
  }

  @TestMethod
  public async saysAProgramNamedFxMayNotBeFxOnlyWhenBothItsStatusAndItsStartFail(): Promise<void> {
    await using host = new FxTestHost();
    const other = host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "unreadable", TEAMRUN_FAKE_ACP_INIT: "invalid" });
    const fxFailing = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "invalid" });
    const statusOnly = host.createAdapter({ TEAMRUN_FAKE_FX_STATUS: "unreadable" });

    const check = await other.checkSignIn(host.provider);
    const failing = await fxFailing.checkSignIn(host.provider);
    const answering = await statusOnly.checkSignIn(host.provider);

    Assert.areEqual(AuthStatus.Error, check.authStatus);
    Assert.isTrue((check.error ?? "").startsWith(Resources.formatFxNotFx(String.empty)), check.error ?? "");
    Assert.areEqual(AuthStatus.Error, failing.authStatus);
    Assert.isFalse((failing.error ?? "").startsWith(Resources.formatFxNotFx(String.empty)), failing.error ?? "");
    Assert.areEqual(AuthStatus.LoggedIn, answering.authStatus, answering.error ?? "");
  }

  @TestMethod
  public async readsAStartThatFailsOtherwiseAsAnErrorNotASignOut(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "invalid" });

    const check = await adapter.checkSignIn(host.provider);
    const listing = await Assert.throwsAsync(() => adapter.listModels(host.provider), Error);

    Assert.areEqual(AuthStatus.Error, check.authStatus, check.error ?? "");
    Assert.areNotEqual(Resources.fxSignedOut, listing.message);
  }

  @TestMethod
  public async listsTheModelOptionsModelsNotItsProvidersWithAutoAskAndFullAccess(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();

    const check = await adapter.checkSignIn(host.provider);
    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(`${AuthStatus.LoggedIn}|0.0.16`, `${check.authStatus}|${check.harnessVersion}`, check.error ?? "");
    Assert.areEqual("true|anthropic/claude-sonnet-4.5,openai/gpt-5", `${listed.signedIn}|${listed.models.map(t => t.id).join(",")}`);
    Assert.areEqual("auto:Auto:false,ask:Ask:false,full-access:Full access:true", listed.modes.map(t => [t.id, t.name, t.unrestricted].join(":")).join(","));
    Assert.areEqual("auto", listed.defaultMode);
  }

  @TestMethod
  public async offersStandardAndFastForEachModelFromTheSessionsFastOptionWithItsChoiceAsTheDefault(): Promise<void> {
    await using host = new FxTestHost();
    const options = FxAdapterTests.options(true);

    const standard = await host.createAdapter().listModels(host.provider);
    const fast = await host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(options.map(t => t["id"] === "fast" ? { ...t, currentValue: "true" } : t)) })
      .listModels(host.provider);

    Assert.areEqual("anthropic/claude-sonnet-4.5:standard=Standard,fast=Fast:standard|openai/gpt-5:standard=Standard,fast=Fast:standard", FxAdapterTests.speedsOf(standard));
    Assert.areEqual("gemini-x:standard=Standard,fast=Fast:fast", FxAdapterTests.speedsOf(fast));
    const cell = ProviderAbilityTable.fx.cellOf(ProviderAbility.ChooseSpeed);
    Assert.areEqual(`${AbilityAnswer.Works} ${AbilitySource.Acp} ${Resources.fxChooseSpeedAbility}`, `${cell.answer} ${cell.source} ${cell.detail}`);
  }

  @TestMethod
  public async setsTheChosenSpeedsFastChoiceBeforeTheTurnAndReportsTheChoiceTheAnswerNames(): Promise<void> {
    await using host = new FxTestHost();
    const fast = new RecordingTurnListener();
    const standard = new RecordingTurnListener();
    const unlisted = new RecordingTurnListener();

    const fastTurn = await host.createAdapter().runTurn(host.request("methods", "ask", null, [], "openai/gpt-5", "high", "fast"), fast, new AbortController().signal);
    const standardTurn = await host.createAdapter().runTurn(host.request("methods", "ask", null, [], "openai/gpt-5", "high", "standard"), standard, new AbortController().signal);
    const unlistedTurn = await host.createAdapter().runTurn(host.request("methods", "ask", null, [], "openai/gpt-5", "high", "ultra"), unlisted, new AbortController().signal);

    Assert.areEqual(`${TurnOutcome.Completed}|${TurnOutcome.Completed}`, `${fastTurn.outcome}|${standardTurn.outcome}`, fastTurn.error ?? standardTurn.error ?? "");
    Assert.areEqual("model=openai/gpt-5,effort=high,fast=true,mode=ask", FxAdapterTests.setsOf(fast));
    Assert.areEqual("model=openai/gpt-5,effort=high,mode=ask", FxAdapterTests.setsOf(standard));
    Assert.areEqual(`${TurnOutcome.Completed}|model=openai/gpt-5,effort=high,mode=ask`, `${unlistedTurn.outcome}|${FxAdapterTests.setsOf(unlisted)}`);
    Assert.areEqual("fast|standard|standard", `${fast.lastObserved?.speed}|${standard.lastObserved?.speed}|${unlisted.lastObserved?.speed}`);
  }

  @TestMethod
  public async setsNoSpeedForATurnThatAsksForNoneAndReportsTheSpeedTheSessionsFastOptionNames(): Promise<void> {
    await using host = new FxTestHost();
    const options = FxAdapterTests.options(true).map(t => t["id"] === "fast" ? { ...t, currentValue: "true" } : t);
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(options) })
      .runTurn(host.request("methods", "ask", null, [], "gemini-x", null, null), listener, new AbortController().signal);

    Assert.areEqual(`${TurnOutcome.Completed}|mode=ask|fast`, `${turn.outcome}|${FxAdapterTests.setsOf(listener)}|${String(listener.lastObserved?.speed)}`, turn.error ?? "");
  }

  @TestMethod
  public async offersNoSpeedAndSetsNoneWhenTheSessionListsNoFastOption(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(FxAdapterTests.options(false)) });
    const listener = new RecordingTurnListener();

    const listed = await adapter.listModels(host.provider);
    const turn = await adapter.runTurn(host.request("methods", "ask", null, [], "gemini-x", null, "fast"), listener, new AbortController().signal);

    Assert.areEqual("gemini-x::null", FxAdapterTests.speedsOf(listed));
    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual("mode=ask", FxAdapterTests.setsOf(listener));
    Assert.isNull(listener.lastObserved?.speed ?? null);
  }

  @TestMethod
  public async startsATitleSessionInAskModeSoFxsAutoReviewRunsNothing(): Promise<void> {
    await using host = new FxTestHost();
    const request = host.request("methods");

    const answer = await TitleAsks.answerAsync(host.createAdapter(), TitleAsks.isolated(request));

    Assert.areEqual("mode=ask", (JSON.parse(answer) as { readonly sets: readonly string[] }).sets.filter(t => t.startsWith("mode=")).join(","));
  }

  @TestMethod
  public async runsATurnWithTheChosenModelEffortAndModeInTheChatsFolder(): Promise<void> {
    await using host = new FxTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("methods", "ask", null, [], "openai/gpt-5", "high"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const echoed = JsonReader.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!);
    Assert.areEqual("model=openai/gpt-5,effort=high,mode=ask", echoed.readStringArray("sets").join(","));
    Assert.areEqual("openai/gpt-5|high", `${listener.lastObserved?.model}|${listener.lastObserved?.effort}`);
  }

  @TestMethod
  public async reportsEachRepliesTokensAndNoPlanUsageWithoutStartingFx(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const turn = await adapter.runTurn(host.request("usage"), listener, new AbortController().signal);
    const started = host.programs.started.length;
    const plan = await adapter.readPlanUsage(host.provider);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual("1200:300:800:100:50:null", listener.usages.map(t => [t.inputTokens, t.outputTokens, t.cacheReadTokens, t.cacheWriteTokens, t.reasoningTokens,
      t.costUsd].map(String).join(":")).join(","));
    Assert.areEqual(0, plan?.windows.length);
    Assert.areEqual(started, host.programs.started.length);
    Assert.areEqual(0, listener.planUsages.length);
  }

  @TestMethod
  public async runsFxAcpInThePersonsOwnFxWithNoFxHomeAndWithoutThePersonsKeys(): Promise<void> {
    await using host = new FxTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ AI_GATEWAY_API_KEY: "fixture", VERCEL_OIDC_TOKEN: "fixture", FX_INSTALL_DIR: "personal", FX_HOME: "personal" })
      .runTurn(host.request("fx-environment"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const echoed = JSON.parse(listener.texts.find(t => t.startsWith("{\"FX_HOME\""))!) as Record<string, unknown>;
    Assert.areEqual(JSON.stringify({ FX_HOME: null, NO_COLOR: "1", AI_GATEWAY_API_KEY: null, VERCEL_OIDC_TOKEN: null, FX_INSTALL_DIR: null }),
      JSON.stringify({ ...echoed, cwd: undefined, args: undefined }));
    Assert.areEqual("acp", (echoed["args"] as string[]).join(" "));
  }

  @TestMethod
  public async sendsImagesInlineAndResumesThroughSessionResume(): Promise<void> {
    await using host = new FxTestHost();
    const image = host.directory.resolve("image.png");
    writeFileSync(image, "fixture-image");
    const adapter = host.createAdapter();
    const files = new RecordingTurnListener();
    const resumed = new RecordingTurnListener();

    await adapter.runTurn(host.request("images", null, null, [new MessageAttachment("image.png", "image/png", 13, image)]), files, new AbortController().signal);
    const turn = await adapter.runTurn(host.request("methods", null, "earlier"), resumed, new AbortController().signal);

    const parts = JSON.parse(files.texts.find(t => t.startsWith("[{"))!) as Record<string, unknown>[];
    Assert.areEqual("text,image", parts.map(t => t["type"]).join(","));
    Assert.areEqual(`${TurnOutcome.Completed}|earlier`, `${turn.outcome}|${turn.nativeSessionId}`, turn.error ?? "");
    const methods = (JSON.parse(resumed.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[] }).methods;
    Assert.isTrue(methods.includes("session/resume"), methods.join(","));
  }

  @TestMethod
  public async takesNoSharedServerUntilASignedInCaptureShowsWhatFxKeeps(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

    Assert.areEqual(Resources.formatSharedMcpUnconfirmed("fx"), adapter.sharedServerUnavailable(stdio, host.provider, host.directory.path)?.reason);
    Assert.areEqual(Resources.formatSharedMcpUnconfirmed("fx"), adapter.sharedServerUnavailable(http)?.reason);
  }

  @TestMethod
  public async keepsForkCompactionAndBackgroundFollowingOffWithTheirReasons(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const compact = new TurnRequest(host.provider, host.directory.resolve("chat"), "/compact", new RequestedSettings("fx", null, null), "fx-session", [], null, null, {},
      true);

    const fork = await Assert.throwsAsync(() => adapter.forkSession(new ForkRequest(host.provider, host.directory.path, "fx-session", "0",
      new RequestedSettings("fx", null, null))), Error);
    const compacted = await adapter.runTurn(compact, listener, new AbortController().signal);

    Assert.areEqual(Resources.formatForkUnavailable("fx"), fork.message);
    Assert.areEqual(`${TurnOutcome.Completed}|${Resources.formatCannotCompact("fx")}`, `${compacted.outcome}|${listener.details.map(t => t.text).join(",")}`);
    Assert.isNull(adapter.backgroundSubAgentsNote);
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => host.request(prompt, null, resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, host.provider, () => adapter.listModels(host.provider)),
      ...turns.probes({ [ProviderAbility.Questions]: TurnAbilityProbes.plain, [ProviderAbility.PlanChecklist]: TurnAbilityProbes.plain, [ProviderAbility.ReplyUsage]: "usage",
        [ProviderAbility.SubAgentRows]: TurnAbilityProbes.plain, [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: TurnAbilityProbes.plain, [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents(TurnAbilityProbes.plain),
      [ProviderAbility.ApprovedTools]: () => turns.runsApprovedToolAsync({ title: `mcp_teamrun_${TurnAbilityProbes.approvedTool}` })
    });
  }

  @TestMethod
  public async sendsFxThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new FxTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }

  private static options(fast: boolean): Record<string, unknown>[] {
    return [
      { type: "select", id: "model", name: "Model", category: "model", currentValue: "gemini-x", options: [{ value: "gemini-x", name: "gemini-x" }] },
      { type: "select", id: "mode", name: "Session Mode", category: "mode", currentValue: "auto", options: [{ value: "auto", name: "Auto" }, { value: "ask", name: "Ask" }] },
      ...(fast ? [{ type: "select", id: "fast", name: "Fast Mode", category: "model", currentValue: "false",
        options: [{ value: "false", name: "false" }, { value: "true", name: "true" }] }] : [])
    ];
  }

  private static speedsOf(list: { readonly models: readonly ProviderModel[] }): string {
    return list.models.map(t => `${t.id}:${t.speeds.map(u => `${u.id}=${u.name}`).join(",")}:${String(t.defaultSpeed)}`).join("|");
  }

  private static setsOf(listener: RecordingTurnListener): string {
    return JsonReader.parse(listener.texts.find(t => t.startsWith("{\"methods\"")) ?? "").readStringArray("sets").join(",");
  }
}
