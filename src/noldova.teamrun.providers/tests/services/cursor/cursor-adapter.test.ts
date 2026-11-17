/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { McpEndpoint, SessionTokens, TimeoutException, TurnOutcome, TurnRequest, TurnTools } from "@noldova/teamrun.core";
import { ApprovalKind, AuthStatus, DetailKind, MessageAttachment, ProviderAbility, QuestionAnswer, ReplyPlan, RequestedSettings, SharedMcpServerDefinition,
  SharedMcpTransport } from "@noldova/teamrun.protocol";
import { NodeProcessStarter, ProcessCommand, ProviderAbilityTable, Resources, SignInException, SignOutException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { CursorTestHost } from "../../fixtures/cursor-test-host.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

@TestClass
export class CursorAdapterTests {
  private static readonly firstMessageTitle: string = "on macOS a Cursor chat keeps its first message as its title, since a title session there would run the person's setup";

  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new CursorTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter(AcpCommandCheck.environment(host.directory.path)), host.request("unused"), host.directory.path);
  }

  @TestMethod
  public async sendsThePromptWithoutWaitingForTeamRunsToolsAsItListsThemOnlyOnceThePromptArrives(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "c1/t1"));
    const request = new TurnRequest(host.provider, host.directory.resolve("chat"), "complete", new RequestedSettings("cursor", null, null), null, [], null, null, {},
      false, tools);

    const result = await host.createAdapter().runTurn(request, listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome, result.error ?? "no error");
    Assert.isFalse(host.timer.requested.includes(Resources.teamRunToolsWait), host.timer.requested.join(","));
    Assert.areEqual(0, listener.sharedFailures.length, JSON.stringify(listener.sharedFailures));
  }

  @TestMethod
  public async takesSharedStdioAndHttpServers(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

    Assert.isNull(adapter.sharedServerUnavailable(stdio));
    Assert.isNull(adapter.sharedServerUnavailable(http));
  }

  @TestMethod
  public async describesATerminalSignInWithItsFoldersASignOutInTeamRunAndNoFork(): Promise<void> {
    await using host = new CursorTestHost();
    const descriptor = host.createAdapter().descriptor;

    Assert.areEqual("cursor:Cursor:true:true:false:false:true", [descriptor.id, descriptor.displayName, descriptor.supportsResume, descriptor.supportsSignInCheck,
      descriptor.supportsFork, descriptor.supportsSignIn, descriptor.supportsSignOut].join(":"));
    Assert.areEqual("null:false", [descriptor.signOutCommand, descriptor.signOutEndsWithCommand].map(String).join(":"));
    Assert.isTrue(descriptor.abilities === ProviderAbilityTable.cursor);
    Assert.areEqual(process.platform === "darwin" ? Resources.cursorOneAccountPerMac : null, descriptor.singleAccount);
    Assert.areEqual(`${descriptor.displayName} can't switch on its own MCP servers here: ${Resources.cursorOwnServersSwitchAbility}.`, descriptor.ownMcpServersUnavailable);
    Assert.areEqual(JSON.stringify({ variable: "CURSOR_CONFIG_DIR", signInCommand: "cursor-agent login", usualFolder: host.directory.resolve("default-profile"),
      toolCommand: null, signInVariables: { CURSOR_DATA_DIR: "data", ...process.platform === "win32" ? { APPDATA: "home/AppData/Roaming" }
        : process.platform === "darwin" ? {} : { XDG_CONFIG_HOME: "home/.config" } }, signInValues: {}, personFolders: [] }),
      JSON.stringify(descriptor.profile?.toJson()));
    const refused = await Assert.throwsAsync(() => host.createAdapter().signIn(host.provider, new AbortController().signal), SignInException);
    Assert.areEqual(Resources.cursorSignInUnavailable, refused.message);
  }

  @TestMethod
  public async listsEachOfItsLiveBracketedModelValuesAsItsOwnModelWithNoEffortLevels(): Promise<void> {
    await using host = new CursorTestHost();

    const listed = await host.createAdapter({ TEAMRUN_FAKE_CURSOR_MODELS: "live" }).listModels(host.provider);

    Assert.areEqual("default[]:Auto:true:[]:null|grok-4.7[context=256k,reasoning_effort=high,fast=true]:grok-4.7:false:[]:null|"
      + "composer-2.5[fast=true]:composer-2.5:false:[]:null|claude-opus-5-5[context=300k,effort=medium,fast=false]:claude-opus-5-5:false:[]:null|"
      + "gemini-4-argon[reasoning_effort=medium]:gemini-4-argon:false:[]:null|gpt-5.6-sol[context=272k,reasoning=medium,fast=false]:gpt-5.6-sol:false:[]:null",
    listed.models.map(t => [t.id, t.displayName, t.isDefault, JSON.stringify(t.effortLevels), String(t.defaultEffort)].join(":")).join("|"));
  }

  @TestMethod
  public async checksThroughASessionWithoutAuthenticatingAndListsItsModelsWithAgentAskPlanAndAllowAll(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const check = await adapter.checkSignIn(host.provider);
    const listed = await adapter.listModels(host.provider);
    await adapter.runTurn(host.request("methods"), listener, new AbortController().signal);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus, check.error ?? "");
    Assert.areEqual("2026.10.22-27dcf5f:Free:person@example.com", `${check.harnessVersion}:${check.identity?.plan}:${check.identity?.email}`);
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual("auto,gpt-5", listed.models.map(t => t.id).join(","));
    Assert.areEqual("agent:Agent:false:false,ask:Ask:false:true,plan:Plan:false:true,allow-all:Allow all:true:false",
      listed.modes.map(t => [t.id, t.name, t.unrestricted, t.readOnly].join(":")).join(","));
    Assert.areEqual("agent", listed.defaultMode);
    Assert.areEqual("plan", adapter.planMode);
    const methods = (JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[] }).methods;
    Assert.isFalse(methods.includes("authenticate"), methods.join(","));
  }

  @TestMethod
  public async keepsTheCheckWithoutAPlanWhenCursorsAboutFails(): Promise<void> {
    await using host = new CursorTestHost();

    const node = new NodeProcessStarter(host.terminator);

    const check = await host.createAdapter({ TEAMRUN_FAKE_CURSOR_ABOUT: "fail" }).checkSignIn(host.provider);
    const unstarted = await host.createAdapter({}, host.command, { start: (command, environment, directory) => {
      if (command.arguments.includes(Resources.cursorAboutArgument))
        throw new Error("fixture");
      return node.start(command, environment, directory);
    }, readEnvironmentAsync: own => node.readEnvironmentAsync(own) }).checkSignIn(host.provider);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus, check.error ?? "");
    Assert.isNull(check.harnessVersion);
    Assert.isNull(check.identity);
    Assert.areEqual(`${AuthStatus.LoggedIn}:null:null`, `${unstarted.authStatus}:${String(unstarted.harnessVersion)}:${String(unstarted.identity)}`);
  }

  @TestMethod
  public async failsATurnWithTheTerminalSignInHintWhenCursorIsSignedOut(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" });

    const turn = await adapter.runTurn(host.request("methods"), new RecordingTurnListener(), new AbortController().signal);
    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(Resources.formatCursorSignIn(host.provider.profileDir, process.platform === "darwin"), turn.error);
    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
    Assert.isTrue(Resources.formatCursorSignIn("/p").includes("cursor-agent login"));
  }

  @TestMethod
  public async failsATurnCursorRefusesInItsAnswerAndKeepsTheRefusalOutOfTheAnswer(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter();
    const run = async (prompt: string): Promise<[Awaited<ReturnType<typeof adapter.runTurn>>, RecordingTurnListener]> => {
      const listener = new RecordingTurnListener();
      return [await adapter.runTurn(host.request(prompt), listener, new AbortController().signal), listener];
    };

    const [payment, paid] = await run("refuse:Add a payment method to continue");
    const [signIn] = await run("refuse:Please sign in to continue");
    const [quoted, said] = await run("refuse:Upgrade your plan to continue, it said");

    Assert.areEqual(TurnOutcome.Failed, payment.outcome);
    Assert.areEqual("Cursor refused the turn: Add a payment method to continue.", payment.error);
    Assert.isFalse(paid.texts.some(t => t.includes("payment method")));
    Assert.areEqual(0, paid.planUsages.length);
    Assert.areEqual(Resources.formatCursorSignIn(host.provider.profileDir, process.platform === "darwin"), signIn.error);
    Assert.areEqual(TurnOutcome.Completed, quoted.outcome);
    Assert.isTrue(said.texts.some(t => t.includes("Upgrade your plan to continue, it said")));
  }

  @TestMethod
  public async namesNoChatFromARefusal(): Promise<void> {
    await using host = new CursorTestHost();
    const platform = process.platform === "darwin" ? "linux" : process.platform;
    const adapter = host.createAdapter({}, host.command, new NodeProcessStarter(host.terminator), platform);

    Assert.isNull(await TitleAsks.askAsync(adapter, TitleAsks.isolated(host.request("refuse:Upgrade your plan to continue"))));
  }

  @TestMethod
  public async failsAPlanRefusalWithCursorsWordsAndReportsNoPlanUsage(): Promise<void> {
    await using host = new CursorTestHost();
    const refusing = new RecordingTurnListener();

    const refused = await host.createAdapter().runTurn(host.request("refuse:Upgrade your plan to continue"), refusing, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, refused.outcome);
    Assert.areEqual("Cursor refused the turn: Upgrade your plan to continue.", refused.error);
    Assert.isFalse(refusing.texts.some(t => t.includes("Upgrade your plan")));
    Assert.areEqual(0, refusing.planUsages.length);
  }

  @TestMethod
  public async namesWhyCursorCouldntLoadASessionItNeverSaved(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("methods", null, "unsaved"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual(Resources.formatResumeFailed("Invalid params: Session \"unsaved\" not found"), listener.texts[0]);
    Assert.areEqual(JSON.stringify({ source: "resume" }), JSON.stringify(listener.details[0]?.payload));
  }

  @TestMethod
  public async startsATitleSessionInItsReadOnlyAskModeOutsideMacOs(): Promise<void> {
    await using host = new CursorTestHost();
    const request = host.request("methods");
    const platform = process.platform === "darwin" ? "linux" : process.platform;

    const answer = await TitleAsks.answerAsync(host.createAdapter({}, host.command, new NodeProcessStarter(host.terminator), platform), TitleAsks.isolated(request));

    Assert.areEqual("mode=ask", (JSON.parse(answer) as { readonly sets: readonly string[] }).sets.filter(t => t.startsWith("mode=")).join(","));
  }

  @TestMethod
  public async listsModelsWithHomePointedAtItsTitleHomeWithoutThePersonsMcpJsonOutsideMacOs(): Promise<void> {
    await using host = new CursorTestHost();
    const person = host.directory.resolve("person");
    mkdirSync(join(person, ".cursor"), { recursive: true });
    writeFileSync(join(person, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const platform = process.platform === "darwin" ? "linux" : process.platform;
    const starter = new WatchingProcessStarter(() => undefined);
    const titleHome = join(host.provider.profileDir, "title-home");

    await host.createAdapter({ HOME: person, USERPROFILE: person }, host.command, starter, platform).listModels(host.provider);

    const variables = platform === "win32" ? ["HOME", "USERPROFILE"] : ["HOME"];
    Assert.areEqual(variables.join(","), Resources.cursorTitleHomeVariables(platform).join(","));
    Assert.isTrue(starter.environments.length > 0);
    Assert.areEqual(starter.environments.map(() => variables.map(t => `${t}=${titleHome}`).join(",")).join("|"),
      starter.environments.map(e => variables.map(t => `${t}=${e[t]}`).join(",")).join("|"));
    Assert.isFalse(existsSync(join(titleHome, ".cursor", "mcp.json")));
  }

  @TestMethod
  public async namesNoChatOnMacOsWhereATitleSessionWouldKeepThePersonsHome(): Promise<void> {
    await using host = new CursorTestHost();

    const mac = host.createAdapter({}, host.command, new NodeProcessStarter(host.terminator), "darwin");
    const other = host.createAdapter({}, host.command, new NodeProcessStarter(host.terminator), "linux");

    Assert.areEqual("false,true", [Object.isUndefined(mac.askIsolated), Object.isUndefined(other.askIsolated)].map(t => !t).join());
    Assert.areEqual(0, host.programs.started.length);
  }

  @TestMethod
  public async passesTheModelAtLaunchAndRunsAskThroughItsModeOption(): Promise<void> {
    await using host = new CursorTestHost();
    const launched = new RecordingTurnListener();
    const chosen = new RecordingTurnListener();
    const asked = new RecordingTurnListener();

    const launch = await host.createAdapter().runTurn(host.request("launch", null, null, [], "gpt-5"), launched, new AbortController().signal);
    const choose = await host.createAdapter().runTurn(host.request("methods", null, null, [], "gpt-5"), chosen, new AbortController().signal);
    const ask = await host.createAdapter().runTurn(host.request("methods", Resources.cursorAskMode), asked, new AbortController().signal);

    const sets = (listener: RecordingTurnListener): string =>
      (JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly sets: readonly string[] }).sets.join(",");
    Assert.areEqual(TurnOutcome.Completed, launch.outcome, launch.error ?? "");
    Assert.areEqual("--model,gpt-5,--disable-project-configs,acp", (JSON.parse(launched.texts.find(t => t.startsWith("{\"args\""))!) as { readonly args: readonly string[] }).args.join(","));
    Assert.areEqual(TurnOutcome.Completed, choose.outcome, choose.error ?? "");
    Assert.areEqual("", sets(chosen));
    Assert.areEqual(TurnOutcome.Completed, ask.outcome, ask.error ?? "");
    Assert.areEqual("mode=ask", sets(asked));
  }

  @TestMethod
  public async plansFirstInCursorsPlanModeAndLeavesItForTheAskedModeOnlyWhenThePersonApprovesAPlanFirstTurnsPlan(): Promise<void> {
    await using host = new CursorTestHost();
    const run = async (mode: string, planFirst: boolean, decision: string): Promise<string> => {
      const listener = new RecordingTurnListener();
      listener.decisions.push(decision);
      const asked = host.request("cursor-plan", mode);
      const turn = await host.createAdapter().runTurn(planFirst ? asked.withRequested(asked.requested.withPlanFirst(true)) : asked, listener,
        new AbortController().signal);
      const text = listener.texts.find(t => t.startsWith("{\"result\""));
      Assert.isDefined(text);
      const echoed = JsonReader.parse(text);
      const plans = listener.details.filter(t => t.kind === DetailKind.Plan).map(t => ReplyPlan.fromJson(t.payload))
        .map(t => Object.isNull(t.text) ? String(t.steps.length) : `${String(t.title)}:${String(t.approved)}:${String(t.rejected)}`);
      return [turn.outcome, echoed.readObject("result").readObject("outcome").readString("outcome"), echoed.readStringArray("sets").join(","), plans.join("|"),
        listener.asks.map(t => t.nativeKind).join(",")].join(" ");
    };

    const approved = await run(Resources.cursorAgentMode, true, Resources.acpApprovePlanOption);
    const refused = await run(Resources.cursorAgentMode, true, Resources.acpKeepPlanningOption);
    const fromAsk = await run(Resources.cursorAskMode, true, Resources.acpApprovePlanOption);
    const chosen = await run(Resources.cursorPlanMode, false, Resources.acpApprovePlanOption);
    const fromAllowAll = await run(Resources.cursorAllowAllMode, true, Resources.acpApprovePlanOption);

    Assert.areEqual(JSON.stringify([
      `${TurnOutcome.Completed} accepted mode=plan,mode=agent Tidy the cache:false:false|1|Tidy the cache:true:false create_plan`,
      `${TurnOutcome.Completed} rejected mode=plan Tidy the cache:false:false|1|Tidy the cache:false:true create_plan`,
      `${TurnOutcome.Completed} accepted mode=plan,mode=ask Tidy the cache:false:false|1|Tidy the cache:true:false create_plan`,
      `${TurnOutcome.Completed} accepted mode=plan Tidy the cache:false:false|1|Tidy the cache:true:false create_plan`,
      `${TurnOutcome.Completed} accepted mode=plan,mode=agent Tidy the cache:false:false|1|Tidy the cache:true:false create_plan`
    ]), JSON.stringify([approved, refused, fromAsk, chosen, fromAllowAll]));
  }

  @TestMethod
  public async runsInItsProfilesFoldersWithoutThePersonsKeysOrCursorSettings(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter({ CURSOR_API_KEY: "fixture", CURSOR_AUTH_TOKEN: "fixture", CURSOR_CONFIG_DIR: "personal" })
      .runTurn(host.request("cursor-environment"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const profile = host.provider.profileDir;
    Assert.areEqual(JSON.stringify({ HOME: host.environment["HOME"] ?? null, CURSOR_CONFIG_DIR: profile, CURSOR_DATA_DIR: join(profile, "data"),
      XDG_CONFIG_HOME: process.platform === "win32" || process.platform === "darwin" ? host.environment["XDG_CONFIG_HOME"] ?? null : join(profile, "home", ".config"),
      APPDATA: process.platform === "win32" ? join(profile, "home", "AppData", "Roaming") : host.environment["APPDATA"] ?? null, NO_OPEN_BROWSER: "1", CURSOR_API_KEY: null,
      CURSOR_AUTH_TOKEN: null }), listener.texts.find(t => t.startsWith("{\"HOME\"")));
    Assert.areEqual("static", (JSON.parse(readFileSync(join(profile, "cli-config.json"), "utf8")) as { readonly channel: string }).channel);
  }

  @TestMethod
  @TestData("execute", "allow-once")
  @TestData("execute", "reject-once")
  @TestData("mcp", "allow-once")
  @TestData("mcp", "reject-once")
  public async approvesOrDeniesCursorsPermissionRequestForOneUseOnlyAndSendsTheChosenOptionBack(call: string, choice: string): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push(choice);

    const turn = await host.createAdapter().runTurn(host.request(`cursor-permission ${call}`), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual(1, listener.asks.length);
    Assert.areEqual(`${call === "execute" ? ApprovalKind.Command : ApprovalKind.Tool}:${call === "execute" ? "npm test" : "personal-lookup"}`,
      `${listener.asks[0]!.kind}:${listener.asks[0]!.summary}`);
    Assert.areEqual("allow-once:Approved:Once,reject-once:Denied:Once", listener.asks[0]!.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
    Assert.areEqual(JSON.stringify({ outcome: { outcome: "selected", optionId: choice } }), listener.texts.find(t => t.startsWith("{\"outcome\"")));
  }

  @TestMethod
  @TestData("execute")
  @TestData("mcp")
  public async allowsCursorsPermissionRequestForOneUseWithoutAskingInAllowAllWhichRunsInCursorsAgentMode(call: string): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();
    const methods = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request(`cursor-permission ${call}`, Resources.cursorAllowAllMode), listener, new AbortController().signal);
    const listed = await host.createAdapter().runTurn(host.request("methods", Resources.cursorAllowAllMode), methods, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(JSON.stringify({ outcome: { outcome: "selected", optionId: "allow-once" } }), listener.texts.find(t => t.startsWith("{\"outcome\"")));
    Assert.areEqual(TurnOutcome.Completed, listed.outcome, listed.error ?? "");
    const echoed = methods.texts.find(t => t.startsWith("{\"methods\""));
    Assert.isDefined(echoed);
    Assert.areEqual("", JsonReader.parse(echoed).readStringArray("sets").join(","));
  }

  @TestMethod
  public async asksCursorsPermissionRequestWhilePlanningFirstInAllowAllAndAllowsItOnceOnlyAfterThePlanIsApproved(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push("reject-once", Resources.acpApprovePlanOption);
    const asked = host.request("cursor-plan-permission", Resources.cursorAllowAllMode);

    const turn = await host.createAdapter().runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const text = listener.texts.find(t => t.startsWith("{\"answers\""));
    Assert.isDefined(text);
    const echoed = JsonReader.parse(text);
    const answers = echoed.readObjectArray("answers").map(t => t.readObject("outcome"));
    Assert.areEqual("reject-once,accepted,allow-once", [answers[0]?.readString("optionId"), answers[1]?.readString("outcome"), answers[2]?.readString("optionId")].join(","));
    Assert.areEqual("execute,create_plan", listener.asks.map(t => t.nativeKind).join(","));
    Assert.areEqual("mode=plan,mode=agent", echoed.readStringArray("sets").join(","));
  }

  @TestMethod
  public async answersCursorsQuestionWithTheChosenOptionIds(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("color", ["Red"], null), new QuestionAnswer("sizes", ["Large"], null)]);

    const turn = await host.createAdapter().runTurn(host.request("cursor-question"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.areEqual(1, listener.questionAsks.length);
    Assert.areEqual(JSON.stringify({ outcome: { outcome: "answered", answers: [{ questionId: "color", selectedOptionIds: ["red"] },
      { questionId: "sizes", selectedOptionIds: ["l"] }] } }), listener.texts.find(t => t.startsWith("{\"outcome\"")));
  }

  @TestMethod
  public async signsOutWithCursorsLogoutInTheProfileAndThenChecksSignedOut(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter();

    await adapter.signOut(host.provider);
    const check = await adapter.checkSignIn(host.provider);

    const recorded = JSON.parse(readFileSync(join(host.provider.profileDir, "signed-out.txt"), "utf8")) as Record<string, string | null>;
    Assert.areEqual(host.provider.profileDir, recorded["CURSOR_CONFIG_DIR"]);
    Assert.areEqual(join(host.provider.profileDir, "data"), recorded["CURSOR_DATA_DIR"]);
    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
  }

  @TestMethod
  public async reportsALogoutThatFailsOrDoesntEnd(): Promise<void> {
    await using host = new CursorTestHost();

    const failed = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_CURSOR_LOGOUT: "fail" }).signOut(host.provider), SignOutException);
    const hung = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_CURSOR_LOGOUT: "hang" }).signOut(host.provider), Error);
    const quiet = await Assert.throwsAsync(() => host.createAdapter({ TEAMRUN_FAKE_CURSOR_LOGOUT: "quiet" }).signOut(host.provider), SignOutException);

    Assert.areEqual(Resources.formatCursorSignOutFailed("Logout refused"), failed.message);
    Assert.areEqual(Resources.formatCursorSignOutFailed(null), quiet.message);
    Assert.areEqual(Resources.formatCursorSignOutTimedOut(host.timings.signInCheckTimeout), hung.message);
    Assert.isInstanceOf(hung, TimeoutException);
    Assert.isFalse(failed instanceof TimeoutException || quiet instanceof TimeoutException);
    Assert.isFalse(existsSync(join(host.provider.profileDir, "signed-out.txt")));
  }

  @TestMethod
  public async sendsImagesInlineAndOtherFilesAsResourceLinksAndResumesThroughALoad(): Promise<void> {
    await using host = new CursorTestHost();
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
  }

  @TestMethod
  public async showsTheImageCursorSavedInTheChatsFolderInTheReply(): Promise<void> {
    await using host = new CursorTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("cursor-image"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const images = listener.details.filter(t => (t.payload as Record<string, unknown> | null)?.["itemType"] === "imageGeneration");
    const savedPath = String((images[0]?.payload as Record<string, unknown> | undefined)?.["savedPath"]);
    Assert.areEqual(realpathSync(host.directory.resolve("chat", "icon.png")), realpathSync(savedPath));
    Assert.areEqual(JSON.stringify([{ kind: DetailKind.Note, text: Resources.formatGeneratedImage(savedPath),
      payload: { itemType: "imageGeneration", status: "completed", savedPath, revisedPrompt: null, failure: null, imageData: "iVBORw0KGgo=", mediaType: "image/png" } }]),
      JSON.stringify(images.map(t => ({ kind: t.kind, text: t.text, payload: t.payload }))));
  }

  @TestMethod
  public async signsInThroughTheCopyItsTurnsRunWhenThatCopyIsOnlyTeamRunsOwnAndStartsNothingToSayIt(): Promise<void> {
    await using host = new CursorTestHost();
    const copy = host.directory.resolve("providers", "cursor");
    mkdirSync(copy, { recursive: true });
    writeFileSync(join(copy, "cursor-agent.cmd"), "");

    const command = await host.createAdapter({}, new ProcessCommand(join(copy, "node.exe"), [join(copy, "index.js")])).readSignInCommand(host.provider);

    Assert.areEqual(JSON.stringify({ command: "cursor-agent login", environment: { PATH: [copy, host.directory.path].join(delimiter) } }), JSON.stringify(command?.toJson()));
    Assert.areEqual(0, host.programs.started.length);
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new CursorTestHost();
    const adapter = host.createAdapter();
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => host.request(prompt, null, resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, host.provider, () => adapter.listModels(host.provider)),
      ...process.platform === Resources.cursorMacPlatform ? { [ProviderAbility.ChatTitle]: CursorAdapterTests.firstMessageTitle } : {},
      ...turns.probes({ [ProviderAbility.Questions]: TurnAbilityProbes.plain, [ProviderAbility.PlanChecklist]: "cursor-todos",
        [ProviderAbility.ReplyUsage]: "usage", [ProviderAbility.SubAgentRows]: "cursor-task", [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: "cursor-image", [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents("cursor-task"),
      [ProviderAbility.ApprovedTools]: async () => {
        await turns.approvedTurnAsync(TurnAbilityProbes.plain);
        return readFileSync(join(host.provider.profileDir, "cli-config.json"), "utf8").includes(TurnAbilityProbes.approvedTool);
      }
    });
  }

  @TestMethod
  public async sendsCursorThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new CursorTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }
}
