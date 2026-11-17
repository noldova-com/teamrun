/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimePart } from "@noldova/computer-use.runtime";
import {
  DataDirectory,
  type IModuleLog,
  type IPermissionRequest,
  OwnershipLock,
  PermissionCenter,
  PermissionDecision,
  PermissionDetailKind,
  PermissionOption,
  PermissionQuestion,
  RememberedPermissionStore,
  ShellDatabase,
  ShellMigrations,
  ToolDescriptor,
  ToolRegistry,
  ToolRisk,
  ToolSession
} from "@noldova/desktop.runtime";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type IPermissionAsker, PermissionAnswer, type PermissionAsk } from "@noldova/teamrun.core";
import { PermissionPayload } from "@noldova/teamrun.protocol";
import { PermissionAnswerer, Resources, RuntimeToolSession, ServedCalls } from "@noldova/teamrun.runtime";

import { AnsweringAsker } from "../fixtures/answering-asker.fixture.js";
import { ComputerUseHarness } from "../fixtures/computer-use-harness.fixture.js";
import { RecordingOutput } from "../fixtures/recording-output.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class PermissionAnswererTests {
  @TestMethod
  public async asksThePersonWithTheRequestsModuleSubjectRiskAndDetailsLeavingOutASecretsValue(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);
    const signal = new AbortController().signal;

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("notes", "session-1", "c1/default", {
      action: "notes.deleteItem", subject: "item-1", title: "Delete the note Groceries", risk: ToolRisk.High, options: [PermissionOption.AllowOnce, PermissionOption.Deny],
      details: [
        { label: "Note", kind: PermissionDetailKind.Text, value: "Groceries" },
        { label: "Command", kind: PermissionDetailKind.Code, value: "notes delete item-1" },
        { label: "Token", kind: PermissionDetailKind.Secret, value: "not-kept" },
        { label: "Reason", kind: PermissionDetailKind.AgentText, value: "It is done." }
      ]
    }, "request-1"), signal);

    Assert.areEqual(PermissionDecision.AllowedOnce, decision);
    Assert.areEqual(1, asker.asks.length);
    const [session, module, ask, asked] = asker.asks[0]!;
    Assert.areEqual("session-1", session);
    Assert.areEqual("notes", module);
    Assert.areEqual("notes.deleteItem", ask.action);
    Assert.areEqual("Delete the note Groceries", ask.title);
    Assert.areEqual("request-1", ask.id);
    Assert.isFalse(ask.remembersInChat);
    Assert.areEqual("request-1", ask.id);
    Assert.areEqual(JSON.stringify({
      module: "notes", subject: "item-1", risk: "High", details: [
        { label: "Note", kind: "Text", value: "Groceries" },
        { label: "Command", kind: "Code", value: "notes delete item-1" },
        { label: "Token", kind: "Secret", value: null },
        { label: "Reason", kind: "AgentText", value: "It is done." }
      ]
    }), JSON.stringify(ask.payload));
    Assert.isTrue(asked === signal);
  }

  @TestMethod
  public async deniesARequestThePersonDoesNotAllowAndGivesOneWithoutASubjectNone(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.Denied);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("notes", "session-1", "c1/default",
      PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.Deny], ToolRisk.Low)), new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, decision);
    Assert.areEqual(JSON.stringify({ module: "notes", subject: null, risk: "Low", details: [] }), JSON.stringify(asker.asks[0]![2].payload));
  }

  @TestMethod
  public async asksWithTheModulesAllowAlwaysLabelAndAnswersItsAllowingAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      ...PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny], ToolRisk.Medium),
      labels: { [PermissionOption.AllowAlways]: "Allow for this chat" }
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, decision);
    const [ask] = asker.asks.map(t => t[2]);
    Assert.areEqual("Allow for this chat", ask?.allowAlwaysLabel);
    Assert.isNull(ask?.takeOverLabel);
    Assert.isFalse(ask?.remembersInChat);
  }

  @TestMethod
  public async asksWithTheModulesTakeOverLabelAndAnswersATakingOverSo(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.TakenOver);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      ...PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.TakeOver], ToolRisk.High),
      labels: { [PermissionOption.TakeOver]: "I'll type it myself" }
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.TakenOver, decision);
    const [ask] = asker.asks.map(t => t[2]);
    Assert.areEqual("I'll type it myself", ask?.takeOverLabel);
    Assert.isNull(ask?.allowAlwaysLabel);
  }

  @TestMethod
  public async leavesOutALabelWhoseOptionTheRequestDoesNotOfferAndAnAllowAlwaysWithoutALabel(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);
    const answerer = new PermissionAnswerer(asker);

    await answerer.answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      ...PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.Deny], ToolRisk.Medium),
      labels: { [PermissionOption.AllowAlways]: "Allow for this chat" }
    }), new AbortController().signal);
    await answerer.answerAsync(new PermissionQuestion("notes", "session-1", "c1/default",
      PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny], ToolRisk.Medium)), new AbortController().signal);

    Assert.areEqual("null,null", asker.asks.map(t => String(t[2].allowAlwaysLabel)).join(","));
  }

  @TestMethod
  public async keepsComputerUsesAllowInThisChatInsteadOfTheModulesAllowAlwaysLabel(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("computer-use", "session-1", "c1/default", {
      ...PermissionAnswererTests.screenRequest([PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny]),
      labels: { [PermissionOption.AllowAlways]: "Allow always" }
    }), new AbortController().signal);

    Assert.areEqual("true null", asker.asks.map(t => `${t[2].remembersInChat} ${String(t[2].allowAlwaysLabel)}`).join(","));
  }

  @TestMethod
  public async deniesWithoutAskingARequestThatOffersNeitherAllowOnceNorALabelledAllowAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("notes", "session-1", "c1/default",
      PermissionAnswererTests.request([PermissionOption.AllowAlways, PermissionOption.Deny], ToolRisk.Medium)), new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, decision);
    Assert.areEqual(0, asker.asks.length);
  }

  @TestMethod
  public async asksARequestThatOffersOnlyALabelledAllowAlwaysWithoutAllowOnceAndAnswersItAllowedAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      ...PermissionAnswererTests.request([PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways], ToolRisk.Medium),
      labels: { [PermissionOption.AllowAlways]: "Allow this site for the project" }
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, decision);
    Assert.areEqual("false Allow this site for the project", asker.asks.map(t => `${t[2].offersAllowOnce} ${String(t[2].allowAlwaysLabel)}`).join(","));
  }

  @TestMethod
  public async allowsBrowsersLowRiskOpeningOfAPageOnceWithoutAsking(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.Denied);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      action: "browser.navigate", subject: "http://site.localhost:8080", title: "Open a page on site.localhost:8080", details: [], risk: ToolRisk.Low,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Allow for this chat" }
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedOnce, decision);
    Assert.areEqual(0, asker.asks.length);
  }

  @TestMethod
  @TestData("browser.click", "Click Send")
  @TestData("browser.type", "Type into Name")
  @TestData("browser.pressKey", "Press Tab on Name")
  public async asksBrowsersLowRiskClickTypingAndKeyPress(action: string, title: string): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.Denied);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      action, subject: "http://site.localhost:8080", title, details: [], risk: ToolRisk.Low, options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, decision);
    Assert.areEqual(`${action} Low`, asker.asks.map(t => `${t[2].action} ${PermissionPayload.fromJson(t[2].payload).risk}`).join(","));
  }

  @TestMethod
  public async asksBrowsersMediumAndHighRiskRequestsAndAnotherModulesLowRiskOne(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.Denied);
    const answerer = new PermissionAnswerer(asker);
    const options = [PermissionOption.AllowOnce, PermissionOption.Deny];

    const decisions = [
      await answerer.answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", PermissionAnswererTests.navigation(options, ToolRisk.Medium)),
        new AbortController().signal),
      await answerer.answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", PermissionAnswererTests.navigation(options, ToolRisk.High)),
        new AbortController().signal),
      await answerer.answerAsync(new PermissionQuestion("git", "session-1", "c1/default", PermissionAnswererTests.request(options, ToolRisk.Low)),
        new AbortController().signal)
    ];

    Assert.areEqual("Denied,Denied,Denied", decisions.join(","));
    Assert.areEqual("browser Medium,browser High,git Low", asker.asks.map(t => `${t[1]} ${PermissionPayload.fromJson(t[2].payload).risk}`).join(","));
  }

  @TestMethod
  public async asksBrowsersLowRiskOpeningThatOffersNoAllowOnce(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("browser", "session-1", "c1/default", {
      ...PermissionAnswererTests.navigation([PermissionOption.AllowAlways, PermissionOption.Deny], ToolRisk.Low),
      labels: { [PermissionOption.AllowAlways]: "Allow this site for the project" }
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, decision);
    Assert.areEqual(1, asker.asks.length);
  }

  @TestMethod
  public async offersAllowOnceOnARequestThatHasIt(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);

    await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("notes", "session-1", "c1/default",
      PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.Deny], ToolRisk.Medium)), new AbortController().signal);

    Assert.areEqual("true", asker.asks.map(t => String(t[2].offersAllowOnce)).join(","));
  }

  @TestMethod
  public async asksComputerUsesGrantOfOneAppInTheChatAndAnswersAnAllowingAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    const decision = await new PermissionAnswerer(asker).answerAsync(PermissionAnswererTests.appQuestion("computer-use", "computer-use.controlApp"),
      new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, decision);
    const ask = asker.asks[0]![2];
    Assert.isTrue(ask.remembersInChat);
    Assert.isFalse(ask.offersAllowOnce);
    Assert.areEqual("computer-use.controlApp", ask.action);
    Assert.areEqual(JSON.stringify({ module: "computer-use", subject: "notepad", risk: "Medium", details: [] }), JSON.stringify(ask.payload));
  }

  @TestMethod
  public async deniesComputerUsesGrantOfOneAppThePersonDoesNotAllow(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.Denied);

    const decision = await new PermissionAnswerer(asker).answerAsync(PermissionAnswererTests.appQuestion("computer-use", "computer-use.controlApp"),
      new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, decision);
    Assert.isTrue(asker.asks[0]![2].remembersInChat);
  }

  @TestMethod
  public async deniesWithoutAskingAnAllowAlwaysOnlyRequestOfAnotherComputerUseActionOrAnotherModule(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);
    const answerer = new PermissionAnswerer(asker);

    const otherAction = await answerer.answerAsync(PermissionAnswererTests.appQuestion("computer-use", "computer-use.takeControl"), new AbortController().signal);
    const otherModule = await answerer.answerAsync(PermissionAnswererTests.appQuestion("notes", "computer-use.controlApp"), new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, otherAction);
    Assert.areEqual(PermissionDecision.Denied, otherModule);
    Assert.areEqual(0, asker.asks.length);
  }

  @TestMethod
  public async asksComputerUsesGrantOfOneAppOnceWhenItOffersNoAllowAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("computer-use", "session-1", "c1/default", {
      action: "computer-use.controlApp", subject: "notepad", title: "Control Notepad", details: [], risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    }), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedOnce, decision);
    Assert.isFalse(asker.asks[0]![2].remembersInChat);
  }

  @TestMethod
  public async asksComputerUsesGrantOfTheScreenInTheChatAndAnswersAnAllowingAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("computer-use", "session-1", "c1/default",
      PermissionAnswererTests.screenRequest([PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny])), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, decision);
    const ask = asker.asks[0]![2];
    Assert.isTrue(ask.remembersInChat);
    Assert.areEqual("computer-use.controlScreen", ask.action);
    Assert.areEqual(JSON.stringify({ module: "computer-use", subject: "screen", risk: "High", details: [] }), JSON.stringify(ask.payload));
  }

  @TestMethod
  public async asksComputerUsesGrantOfTheScreenOnceWhenItOffersNoAllowAlways(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);

    const decision = await new PermissionAnswerer(asker).answerAsync(new PermissionQuestion("computer-use", "session-1", "c1/default",
      PermissionAnswererTests.screenRequest([PermissionOption.AllowOnce, PermissionOption.Deny])), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedOnce, decision);
    Assert.isFalse(asker.asks[0]![2].remembersInChat);
  }

  @TestMethod
  public async letsTheBaseRememberTheScreenAllowedInOneChatForThatChatOnly(): Promise<void> {
    using folder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    const log: IModuleLog = { write: () => undefined };
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);
    const center = new PermissionCenter("teamrun");
    center.open(new RememberedPermissionStore(database));
    center.registerAnswerer("teamrun", new PermissionAnswerer(asker), log);
    const descriptor = new ToolDescriptor({
      name: "computer_list_apps", description: "Lists the apps.", inputSchema: { type: "object" },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.High }, deadline: { default: 2_000, maximum: 5_000 }, isResumable: true
    }, ["computer_list_apps"]);
    const request = PermissionAnswererTests.screenRequest([PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny]);
    const first = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-1", "c1/default", {}, new ToolRegistry()),
      request, new AbortController().signal);
    const later = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-2", "c1/default", {}, new ToolRegistry()),
      request, new AbortController().signal);
    const elsewhere = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-3", "c2/default", {}, new ToolRegistry()),
      request, new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, first.decision);
    Assert.areEqual(PermissionDecision.AllowedAlways, later.decision);
    Assert.isTrue(later.isRemembered);
    Assert.areEqual(PermissionDecision.AllowedAlways, elsewhere.decision);
    Assert.isFalse(elsewhere.isRemembered);
    Assert.areEqual("session-1,session-3", asker.asks.map(t => t[0]).join(","));
  }

  @TestMethod
  public async letsTheBaseRememberAnAppAllowedInOneChatForThatChatOnly(): Promise<void> {
    using folder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    const log: IModuleLog = { write: () => undefined };
    const asker = new RecordingAsker(PermissionAnswer.AllowedAlways);
    const center = new PermissionCenter("teamrun");
    center.open(new RememberedPermissionStore(database));
    center.registerAnswerer("teamrun", new PermissionAnswerer(asker), log);
    const descriptor = new ToolDescriptor({
      name: "computer_click", description: "Clicks in an app.", inputSchema: { type: "object" },
      risk: { default: ToolRisk.Medium, maximum: ToolRisk.High }, deadline: { default: 2_000, maximum: 5_000 }, isResumable: true
    }, ["computer_click"]);
    const first = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-1", "c1/default", {}, new ToolRegistry()),
      PermissionAnswererTests.appRequest(), new AbortController().signal);
    const later = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-2", "c1/default", {}, new ToolRegistry()),
      { ...PermissionAnswererTests.appRequest(), options: [PermissionOption.AllowOnce, PermissionOption.Deny], isRememberedOnly: true }, new AbortController().signal);
    const elsewhere = await center.requestAsync("computer-use", descriptor, log, new ToolSession("session-3", "c2/default", {}, new ToolRegistry()),
      PermissionAnswererTests.appRequest(), new AbortController().signal);

    Assert.areEqual(PermissionDecision.AllowedAlways, first.decision);
    Assert.areEqual(PermissionDecision.AllowedAlways, later.decision);
    Assert.isTrue(later.isRemembered);
    Assert.areEqual(PermissionDecision.AllowedAlways, elsewhere.decision);
    Assert.isFalse(elsewhere.isRemembered);
    Assert.areEqual("session-1,session-3", asker.asks.map(t => t[0]).join(","));
  }

  @TestMethod
  public async namesTheServedCallEachRequestsCallIdIsForAndNoneForARequestWithoutOneOrForACallThatEnded(): Promise<void> {
    const asker = new RecordingAsker(PermissionAnswer.AllowedOnce);
    const calls = new ServedCalls();
    const choose = calls.open("browser_click", { ref: "e5", element: "Choose Team" });
    const cancel = calls.open("browser_click", { ref: "e7", element: "Cancel" });
    const ended = calls.open("browser_type", { ref: "e9", text: "Ada" });
    calls.close(ended);
    const answerer = new PermissionAnswerer(asker, calls);
    const question = (callId: string | null): PermissionQuestion => Object.assign(new PermissionQuestion("browser", "session-1", "c1/default",
      PermissionAnswererTests.request([PermissionOption.AllowOnce, PermissionOption.Deny], ToolRisk.Medium)), Object.isNull(callId) ? {} : { callId });

    for (const t of [cancel, choose, ended, null])
      await answerer.answerAsync(question(t), new AbortController().signal);

    Assert.areEqual(JSON.stringify([
      { tool: "browser_click", input: { ref: "e7", element: "Cancel" } },
      { tool: "browser_click", input: { ref: "e5", element: "Choose Team" } },
      null,
      null
    ]), JSON.stringify(asker.asks.map(t => PermissionPayload.fromJson(t[2].payload).served)));
  }

  @TestMethod
  public async everyComputerToolCalledThroughTeamRunsMcpServerAsksThePermissionCenterForTheScreenAndRunsNothingWhenThePersonDenies(): Promise<void> {
    const inputs = PermissionAnswererTests.validInputs();
    const part = new RuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker([ComputerUseHarness.SCREEN_ACTION]);

    const results = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      const session = new RuntimeToolSession(context.tools.openSession(ComputerUseHarness.SCOPE, {}));
      const called: JsonObject[] = [];
      for (const [name, input] of inputs)
        called.push(await session.callToolAsync(name, input, new AbortController().signal));
      return called;
    });

    Assert.areEqual(JSON.stringify([...Resources.computerUseTools].sort()), JSON.stringify(inputs.map(t => t[0]).sort()));
    Assert.areEqual(JSON.stringify(inputs.map(t => `${ComputerUseHarness.SCREEN_ACTION}:${t[0]}`)),
      JSON.stringify(asker.asks.map(t => `${t.action}:${PermissionAnswererTests.toolOf(t)}`)));
    Assert.areEqual(JSON.stringify(inputs.map(() => ({
      content: [{ type: "text", text: "Denied: The person didn't allow this conversation to see and control the screen." }], isError: true
    }))), JSON.stringify(results));
  }

  @TestMethod
  public async startsTheChatsNextSessionThroughTeamRunsMcpServerFromTheScreenAllowedInThisChatAndAsksAnotherChatAgain(): Promise<void> {
    const part = new RuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker([]);
    const scopes = [ComputerUseHarness.SCOPE, ComputerUseHarness.SCOPE, "c2/default"];

    const { sessions, results } = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      const called: JsonObject[] = [];
      for (const scope of scopes) {
        const session = context.tools.openSession(scope, {});
        called.push(await new RuntimeToolSession(session).callToolAsync(ComputerUseHarness.LISTED_TOOL, {}, new AbortController().signal));
        session.end();
      }
      return { sessions: context.tools.sessions.map(t => t.id), results: called };
    });

    Assert.isFalse(results.some(t => t["isError"] === true), JSON.stringify(results));
    Assert.areEqual([sessions[0], sessions[2]].join(","), asker.sessions.join(","));
    Assert.areEqual(`${ComputerUseHarness.SCREEN_ACTION}:true,${ComputerUseHarness.SCREEN_ACTION}:true`,
      asker.asks.map(t => `${t.action}:${t.remembersInChat}`).join(","));
  }

  @TestMethod
  public async asksThroughTeamRunsMcpServerForAnAppInTheChatWithWhatThePersonDecidesOnAndItsAllowInThisChatReachesTheModuleAsGranted(): Promise<void> {
    const { asks, result } = await PermissionAnswererTests.requestAppAsync(true);

    Assert.areEqual(`${ComputerUseHarness.SCREEN_ACTION}:true,${ComputerUseHarness.APP_ACTION}:true`, asks.map(t => `${t.action}:${t.remembersInChat}`).join(","));
    Assert.areEqual(JSON.stringify({
      module: ComputerUseHarness.MODULE, subject: ComputerUseHarness.NOTES.identity.id, risk: "Medium", details: [
        { label: "app", kind: "Text", value: "Notes" },
        { label: "identity", kind: "Text", value: ComputerUseHarness.NOTES.identity.id },
        { label: "publisher", kind: "Text", value: "Example Ltd" },
        { label: "tier", kind: "Text", value: "Full" },
        { label: "reason", kind: "AgentText", value: ComputerUseHarness.REASON }
      ]
    }), JSON.stringify(asks.at(1)?.payload));
    Assert.areEqual(JSON.stringify({ apps: [{ identity: ComputerUseHarness.NOTES.identity.id, outcome: "Granted", isGranted: true, tier: "Full" }] }),
      JSON.stringify(result));
  }

  @TestMethod
  public async anAppThePersonDeniesThroughTeamRunsMcpServerReachesTheModuleAsDenied(): Promise<void> {
    const { asks, result } = await PermissionAnswererTests.requestAppAsync(false);

    Assert.areEqual(`${ComputerUseHarness.SCREEN_ACTION},${ComputerUseHarness.APP_ACTION}`, asks.map(t => t.action).join(","));
    Assert.areEqual(JSON.stringify({ apps: [{ identity: ComputerUseHarness.NOTES.identity.id, outcome: "Denied", isGranted: false, tier: null }] }),
      JSON.stringify(result));
  }

  private static request(options: readonly PermissionOption[], risk: ToolRisk): IPermissionRequest {
    return { action: "notes.archive", title: "Archive the notes", details: [], risk, options };
  }

  private static navigation(options: readonly PermissionOption[], risk: ToolRisk): IPermissionRequest {
    return { action: "browser.navigate", subject: "http://site.localhost:8080", title: "Open a page on site.localhost:8080", details: [], risk, options };
  }

  private static appRequest(): IPermissionRequest {
    return {
      action: "computer-use.controlApp", subject: "notepad", title: "Control Notepad", details: [], risk: ToolRisk.Medium,
      options: [PermissionOption.AllowAlways, PermissionOption.Deny]
    };
  }

  private static screenRequest(options: readonly PermissionOption[]): IPermissionRequest {
    return { action: "computer-use.controlScreen", subject: "screen", title: "See and control the screen", details: [], risk: ToolRisk.High, options };
  }

  private static appQuestion(module: string, action: string): PermissionQuestion {
    return new PermissionQuestion(module, "session-1", "c1/default", { ...PermissionAnswererTests.appRequest(), action });
  }

  private static async requestAppAsync(allowsApp: boolean): Promise<{ asks: readonly PermissionAsk[]; result: JsonValue }> {
    const part = new RuntimePart(() => ComputerUseHarness.backend());
    const asker = new AnsweringAsker(allowsApp ? [] : [ComputerUseHarness.APP_ACTION]);

    const outcome = await ComputerUseHarness.runAsync(part, asker, async context => {
      await part.activateAsync(context);
      return await new RuntimeToolSession(context.tools.openSession(ComputerUseHarness.SCOPE, {})).callToolAsync("computer_request_apps",
        { apps: [ComputerUseHarness.NOTES.identity.id], reason: ComputerUseHarness.REASON }, new AbortController().signal);
    });

    Assert.isFalse(outcome["isError"] === true, JSON.stringify(outcome));
    return { asks: asker.asks, result: outcome["structuredContent"] ?? null };
  }

  private static validInputs(): readonly (readonly [string, JsonObject])[] {
    return [
      ["computer_list_displays", {}],
      ["computer_list_apps", {}],
      ["computer_request_apps", { apps: [ComputerUseHarness.NOTES.identity.id], reason: ComputerUseHarness.REASON }],
      ["computer_screenshot", {}],
      ["computer_zoom", { region: [0, 0, 1, 1] }],
      ["computer_read_window", {}],
      ["computer_click", { x: 0, y: 0, summary: "Opens the note." }],
      ["computer_scroll", { x: 0, y: 0, direction: "down", amount: 1, summary: "Shows the rest." }],
      ["computer_move", { x: 0, y: 0 }],
      ["computer_drag", { to: [1, 1], summary: "Moves the card." }],
      ["computer_type", { text: "a", summary: "Types the title." }],
      ["computer_key", { keys: "Enter", summary: "Saves the note." }],
      ["computer_batch", { actions: [{ action: "click", x: 0, y: 0 }], summary: "Opens the note." }]
    ];
  }

  private static toolOf(ask: PermissionAsk): string {
    return JSON.stringify(ask.payload).match(/\{"label":"tool","kind":"Text","value":"([a-z_]+)"\}/)?.[1] ?? "";
  }
}

class RecordingAsker implements IPermissionAsker {
  public readonly asks: [string, string, PermissionAsk, AbortSignal][] = [];
  private readonly answer: PermissionAnswer;

  public constructor(answer: PermissionAnswer) {
    this.answer = answer;
  }

  public askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer> {
    this.asks.push([session, module, ask, signal]);
    return Promise.resolve(this.answer);
  }
}
