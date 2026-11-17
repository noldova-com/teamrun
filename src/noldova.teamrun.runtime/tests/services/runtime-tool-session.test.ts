/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IToolDescriptor,
  PermissionDecision,
  PermissionOption,
  ToolContent,
  ToolDescriptor,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult,
  ToolRisk
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { PanelName } from "@noldova/teamrun.protocol";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ToolCallRecord } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { Resources, RuntimeToolSession, RuntimeToolSessions, ServedCalls } from "@noldova/teamrun.runtime";

import { PageWindows } from "../fixtures/page-windows.fixture.js";
import { RegistryToolsContext } from "../fixtures/registry-tools-context.fixture.js";

@TestClass
export class RuntimeToolSessionTests {
  private static readonly PICTURE: string = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  private static readonly DECLARED: readonly string[] = ["teamrun_picture", "teamrun_broken", "teamrun_plain"];
  private static readonly DEADLINE: number = 5_000;
  private static readonly GIT_TOOLS: readonly string[] = ["git_status", "git_diff", "git_log", "git_branches", "git_stage", "git_unstage", "git_create_branch",
    "git_switch_branch", "git_commit", "git_push", "git_pull"];

  @TestMethod
  public async listsTeamRunsTerminalsAndComputerUsesToolsAsMcpToolsButNoOtherModulesEvenOnesNamedLikeTheirs(): Promise<void> {
    const session = new RuntimeToolSession(RuntimeToolSessionTests.tools().openSession("c1/default", {}));

    const listed = await session.listToolsAsync();

    Assert.areEqual(JSON.stringify([
      {
        name: "teamrun_picture", title: "Picture", description: "Draws a picture.", inputSchema: { type: "object" },
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
      },
      { name: "teamrun_broken", description: "Breaks.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
      { name: "teamrun_plain", description: "Answers.", inputSchema: { type: "object" }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
      { name: "terminal_list", description: "Lists terminals.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
      { name: "computer_list_apps", description: "Lists apps.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
      { name: "browser_snapshot", description: "Reads the page.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
      { name: "git_github_read", description: "Reads an issue.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }
    ]), JSON.stringify(listed));
  }

  @TestMethod
  public async answersWithTheResultsImagesAndTextButNotTheFieldsOfATeamRunTool(): Promise<void> {
    const session = new RuntimeToolSession(RuntimeToolSessionTests.tools().openSession("c1/default", {}));

    const picture = await session.callToolAsync("teamrun_picture", {}, new AbortController().signal);
    const plain = await session.callToolAsync("teamrun_plain", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({
      content: [{ type: "image", data: RuntimeToolSessionTests.PICTURE, mimeType: "image/png" }, { type: "text", text: "A dot." }], isError: false
    }), JSON.stringify(picture));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Done." }], isError: false }), JSON.stringify(plain));
  }

  @TestMethod
  public async keepsABrowserResultsImageAndTextAndLeavesItsFieldsOutOfItsDescriptionAndAnswer(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    RuntimeToolSessionTests.registerFields(context, "browser", "browser_screenshot",
      [ToolContent.fromImage(RuntimeToolSessionTests.PICTURE, "image/png", null), ToolContent.fromText("The page at https://shop.test/cart.", null)],
      { page: { url: "https://shop.test/cart", title: "Cart" } });
    const session = new RuntimeToolSession(context.openSession("c1/default", {}));

    const listed = (await session.listToolsAsync()).find(t => t["name"] === "browser_screenshot");
    const shot = await session.callToolAsync("browser_screenshot", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({ name: "browser_screenshot", description: "Shows browser_screenshot.", inputSchema: { type: "object" },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }), JSON.stringify(listed));
    Assert.areEqual(JSON.stringify({
      content: [{ type: "image", data: RuntimeToolSessionTests.PICTURE, mimeType: "image/png" }, { type: "text", text: "The page at https://shop.test/cart." }],
      isError: false
    }), JSON.stringify(shot));
  }

  @TestMethod
  public async servesTerminalsAndComputerUsesFieldsWhichHoldTheirWholeResultAndGivesAResultWithOnlyFieldsAsTheirText(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    RuntimeToolSessionTests.registerFields(context, "terminal", "terminal_read", [ToolContent.fromText("ok", null)], { terminal_id: "t1", output: "ok" });
    RuntimeToolSessionTests.registerFields(context, "computer-use", "computer_click", [], { clicked: 1 });
    RuntimeToolSessionTests.registerFields(context, "git-github", "git_github_pr_checks", [], { checks: [] });
    const session = new RuntimeToolSession(context.openSession("c1/default", {}));

    const schemas = (await session.listToolsAsync()).filter(t => ["terminal_read", "computer_click", "git_github_pr_checks"].includes(String(t["name"])))
      .map(t => [t["name"], t["outputSchema"] ?? null]);
    const answers = [await session.callToolAsync("terminal_read", {}, new AbortController().signal),
      await session.callToolAsync("computer_click", {}, new AbortController().signal),
      await session.callToolAsync("git_github_pr_checks", {}, new AbortController().signal)];

    Assert.areEqual(JSON.stringify([["terminal_read", { type: "object" }], ["computer_click", { type: "object" }], ["git_github_pr_checks", null]]),
      JSON.stringify(schemas));
    Assert.areEqual(JSON.stringify([
      { content: [{ type: "text", text: "ok" }], structuredContent: { terminal_id: "t1", output: "ok" }, isError: false },
      { content: [{ type: "text", text: "{\"clicked\":1}" }], structuredContent: { clicked: 1 }, isError: false },
      { content: [{ type: "text", text: "{\"checks\":[]}" }], isError: false }
    ]), JSON.stringify(answers));
  }

  @TestMethod
  public async recordsEachBrowserCallsFieldsFirstImageOrFailureForItsStepAndNoOtherToolsCalls(): Promise<void> {
    const context = RuntimeToolSessionTests.tools([], ["browser.stale"]);
    RuntimeToolSessionTests.registerFields(context, "browser", "browser_screenshot",
      [ToolContent.fromText("The page at https://shop.test/cart.", null), ToolContent.fromImage(RuntimeToolSessionTests.PICTURE, "image/png", null)],
      { page: { url: "https://shop.test/cart", title: "Cart" } });
    const records: ToolCallRecord[] = [];
    const session = new RuntimeToolSessions(context, []).open("c1/t1", "c1", "/work/project", "p1", "Ada", call => records.push(call));

    await session.callToolAsync("browser_screenshot", { type: "png" }, new AbortController().signal);
    await session.callToolAsync("browser_snapshot", {}, new AbortController().signal);
    await session.callToolAsync("browser_snapshot", {}, new AbortController().signal);
    await session.callToolAsync("teamrun_picture", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify([
      ["browser_screenshot", { type: "png" }, { page: { url: "https://shop.test/cart", title: "Cart" } }, { data: RuntimeToolSessionTests.PICTURE, mediaType: "image/png" }],
      ["browser_snapshot", {}, { failure: { code: ToolFailureCode.Unavailable, moduleCode: "browser.stale" } }, null],
      ["browser_snapshot", {}, {}, null]
    ]), JSON.stringify(records.map(t => [t.tool, t.input, t.fields, t.image])));
    session.end();
  }

  @TestMethod
  public async recordsTheRequestThatDecidedEachBrowserCallTheFirstThatDidntAllowItOrElseItsLast(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    const answers = [PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce, PermissionDecision.Denied, PermissionDecision.AllowedOnce];
    const asked: string[] = [];
    context.center.registerAnswerer("teamrun", { answerAsync: t => {
      asked.push(t.id);
      return Promise.resolve(answers.shift() ?? PermissionDecision.Denied);
    } }, { write: () => undefined });
    context.registry.register("browser", new ToolDescriptor({
      ...RuntimeToolSessionTests.descriptor("browser_click", "Clicks."), hints: { isReadOnly: false }, risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
      isResumable: true
    }, ["browser_click"]), {
      handleAsync: async t => {
        const decisions: PermissionDecision[] = [];
        for (const risk of [ToolRisk.Medium, ToolRisk.High])
          decisions.push((await t.requestPermissionAsync({ action: "browser.click", title: "Click Pay", details: [], risk,
            options: [PermissionOption.AllowOnce, PermissionOption.Deny] })).decision);
        if (decisions.some(d => d !== PermissionDecision.AllowedOnce))
          throw new ToolFailureException(new ToolFailure(ToolFailureCode.Denied, "The person denied it."));
        return new ToolResult([]);
      }
    }, ["browser_click"], { write: () => undefined });
    const records: ToolCallRecord[] = [];
    const session = new RuntimeToolSessions(context, []).open("c1/t1", "c1", "/work/project", "p1", "Ada", call => records.push(call));

    await session.callToolAsync("browser_snapshot", {}, new AbortController().signal);
    await session.callToolAsync("browser_click", { ref: "e5" }, new AbortController().signal);
    await session.callToolAsync("browser_click", { ref: "e5" }, new AbortController().signal);

    const permissions = records.map(t => t.permission);
    Assert.areEqual(JSON.stringify([
      null,
      { risk: ToolRisk.High, decision: PermissionDecision.AllowedOnce, isRemembered: false },
      { risk: ToolRisk.Medium, decision: PermissionDecision.Denied, isRemembered: false }
    ]), JSON.stringify(permissions.map(t => Object.isNull(t) ? null : { risk: t.risk, decision: t.decision, isRemembered: t.isRemembered })));
    Assert.areEqual(JSON.stringify([asked[1], asked[2]]), JSON.stringify(permissions.flatMap(t => Object.isNull(t) ? [] : [t.id])));
    session.end();
  }

  @TestMethod
  public async answersAFailureWithItsCodeModuleCodeAndContent(): Promise<void> {
    const session = new RuntimeToolSession(RuntimeToolSessionTests.tools().openSession("c1/default", {}));

    const broken = await session.callToolAsync("teamrun_broken", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Unavailable (teamrun.down): The index is down." }, { type: "text", text: "Try later." }], isError: true }),
      JSON.stringify(broken));
  }

  @TestMethod
  public async refusesAnotherModulesToolAndEndsItsSession(): Promise<void> {
    const tools = new RuntimeToolSessions(RuntimeToolSessionTests.tools(), ["teamrun_plain"]);
    const session = tools.open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const foreign = await session.callToolAsync("other_tool", {}, new AbortController().signal);
    const lookalike = await session.callToolAsync("terminal_spy", {}, new AbortController().signal);
    const computerLookalike = await session.callToolAsync("computer_spy", {}, new AbortController().signal);
    session.end();
    const ended = await session.callToolAsync("teamrun_plain", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Refused: TeamRun's MCP server serves only TeamRun's, Terminal's, computer use's, the Browser's and the Git modules' tools, not other_tool." }], isError: true }),
      JSON.stringify(foreign));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Refused: TeamRun's MCP server serves only TeamRun's, Terminal's, computer use's, the Browser's and the Git modules' tools, not terminal_spy." }], isError: true }),
      JSON.stringify(lookalike));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Refused: TeamRun's MCP server serves only TeamRun's, Terminal's, computer use's, the Browser's and the Git modules' tools, not computer_spy." }], isError: true }),
      JSON.stringify(computerLookalike));
    Assert.isTrue(JSON.stringify(ended).includes("\"text\":\"Unavailable"));
    Assert.areEqual(JSON.stringify(["teamrun_plain"]), JSON.stringify(tools.approvedTools));
  }

  @TestMethod
  public async callsTerminalsToolsWithTheChatsFolderNoSharedTerminalsAndTheChatAsOwner(): Promise<void> {
    const called: JsonObject[] = [];
    const context = RuntimeToolSessionTests.tools(called);
    const tools = new RuntimeToolSessions(context, []);
    const session = tools.open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const listed = await session.callToolAsync("terminal_list", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "No terminals." }], isError: false }), JSON.stringify(listed));
    Assert.areEqual(JSON.stringify([{ "terminal.folder": "/work/project", "terminal.shared": [], "terminal.owner": "teamrun.chat/c1", "git.folder": "/work/project",
      page: "c1", profileKey: "p1", agentName: "Ada" }]),
      JSON.stringify(called));
    Assert.areEqual(JSON.stringify([{ "terminal.folder": "/work/project", "terminal.shared": [], "terminal.owner": "teamrun.chat/c1", "git.folder": "/work/project",
      page: "c1", profileKey: "p1", agentName: "Ada" }]),
      JSON.stringify(context.sessions.map(t => t.bindings)));
    session.end();
  }

  @TestMethod
  public async bindsAChatOutsideProjectsToTheProjectlessBrowserWorkspace(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    const session = new RuntimeToolSessions(context, []).open("c2/default", "c2", "/chats/c2", null, "Codex", () => undefined);

    Assert.areEqual(JSON.stringify([["/chats/c2", "c2", "teamrun-chats", "Codex"]]),
      JSON.stringify(context.sessions.map(t => [t.bindings["git.folder"], t.bindings["page"], t.bindings["profileKey"], t.bindings["agentName"]])));
    session.end();
  }

  @TestMethod
  public async opensTheChatsPageWhenABrowserToolFindsItClosedAndCallsOnceMore(): Promise<void> {
    const windows = new PageWindows();
    const context = RuntimeToolSessionTests.tools([], ["browser.viewClosed"]);
    const session = new RuntimeToolSessions(context, [], null, windows).open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const answer = await session.callToolAsync("browser_snapshot", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify([[PanelName.Page, "c1", true, "c1"]]), JSON.stringify(windows.requests));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "A page." }], isError: false }), JSON.stringify(answer));
    session.end();
  }

  @TestMethod
  public async callsAgainUntilThePageItOpenedShows(): Promise<void> {
    const windows = new PageWindows();
    const timer = new ManualTimer();
    const session = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], Array<string>(3).fill("browser.viewClosed")), [], null, windows, timer)
      .open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    let waited = timer.delayed;
    const answering = session.callToolAsync("browser_snapshot", {}, new AbortController().signal);
    for (let wait = 0; wait < 2; wait++) {
      await waited;
      waited = timer.delayed;
      timer.advance(Resources.pageShowStep);
    }

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "A page." }], isError: false }), JSON.stringify(await answering));
    Assert.areEqual(JSON.stringify([2, 1]), JSON.stringify([timer.begun, windows.requests.length]));
    session.end();
  }

  @TestMethod
  public async answersTheClosedPageWhenItDoesntShowWithinTheToolsDeadline(): Promise<void> {
    const timer = new ManualTimer();
    const session = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], Array<string>(40).fill("browser.viewClosed")), [], null, new PageWindows(), timer)
      .open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);
    const waits = RuntimeToolSessionTests.DEADLINE / Resources.pageShowStep;

    let waited = timer.delayed;
    const answering = session.callToolAsync("browser_snapshot", {}, new AbortController().signal);
    for (let wait = 0; wait < waits; wait++) {
      await waited;
      waited = timer.delayed;
      timer.advance(Resources.pageShowStep);
    }

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Unavailable (browser.viewClosed): The page is closed." }], isError: true }), JSON.stringify(await answering));
    Assert.areEqual(JSON.stringify([waits, 0]), JSON.stringify([timer.begun, timer.pending]));
    session.end();
  }

  @TestMethod
  public async answersTheClosedPageWhenTheCallIsWithdrawnWhileThePageIsAwaited(): Promise<void> {
    const timer = new ManualTimer();
    const withdrawn = new AbortController();
    const session = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], Array<string>(3).fill("browser.viewClosed")), [], null, new PageWindows(), timer)
      .open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const waited = timer.delayed;
    const answering = session.callToolAsync("browser_snapshot", {}, withdrawn.signal);
    await waited;
    withdrawn.abort(new Error("Withdrawn."));

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Unavailable (browser.viewClosed): The page is closed." }], isError: true }), JSON.stringify(await answering));
    Assert.areEqual(JSON.stringify([1, 0]), JSON.stringify([timer.begun, timer.pending]));
    session.end();
  }

  @TestMethod
  public async answersTheClosedPageWithWhyItCouldntOpenItOrAsItIsWithNoOpener(): Promise<void> {
    const refused = new Error("The person is typing in TeamRun, so the panel was left as it is; ask again when they stop.");
    const failing = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], ["browser.viewClosed"]), [], null, new PageWindows(refused))
      .open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);
    const odd = new RuntimeToolSession(RuntimeToolSessionTests.tools([], ["browser.viewClosed"]).openSession("c1/t1", {}), () => Promise.reject("No window."));
    const bare = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], ["browser.viewClosed"]), []).open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const answers = [await failing.callToolAsync("browser_snapshot", {}, new AbortController().signal),
      await odd.callToolAsync("browser_snapshot", {}, new AbortController().signal), await bare.callToolAsync("browser_snapshot", {}, new AbortController().signal)];

    Assert.areEqual(JSON.stringify([`The page is closed. TeamRun couldn't open it: ${refused.message}`, "The page is closed. TeamRun couldn't open it: No window.",
      "The page is closed."].map(t => ({ content: [{ type: "text", text: `Unavailable (browser.viewClosed): ${t}` }], isError: true }))), JSON.stringify(answers));
    failing.end();
    odd.end();
    bare.end();
  }

  @TestMethod
  public async opensNoPageForAnotherFailureOfABrowserTool(): Promise<void> {
    const windows = new PageWindows();
    const session = new RuntimeToolSessions(RuntimeToolSessionTests.tools([], ["browser.staleReference"]), [], null, windows)
      .open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const answer = await session.callToolAsync("browser_snapshot", {}, new AbortController().signal);

    Assert.areEqual("[]", JSON.stringify(windows.requests));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Unavailable (browser.staleReference): The page is closed." }], isError: true }),
      JSON.stringify(answer));
    session.end();
  }

  @TestMethod
  public async callsComputerUsesToolsInTheChatsSession(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    const tools = new RuntimeToolSessions(context, []);
    const session = tools.open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const listed = await session.callToolAsync("computer_list_apps", {}, new AbortController().signal);

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: "Notes." }], isError: false }), JSON.stringify(listed));
    Assert.areEqual("c1/t1", context.sessions.at(0)?.scope);
    session.end();
  }

  @TestMethod
  public async listsAndCallsEachToolOfTheGitModuleBesideTheGitHubModulesInTheChatsSession(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    for (const name of RuntimeToolSessionTests.GIT_TOOLS)
      context.registry.register("git", new ToolDescriptor(RuntimeToolSessionTests.descriptor(name, `Runs ${name}.`), [name]),
        { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText(name, null)])) }, [name], { write: () => undefined });
    const session = new RuntimeToolSession(context.openSession("c1/default", {}));

    const listed = (await session.listToolsAsync()).map(t => String(t["name"])).filter(t => t.startsWith("git_"));
    const answers = await Promise.all(RuntimeToolSessionTests.GIT_TOOLS.map(t => session.callToolAsync(t, {}, new AbortController().signal)));

    Assert.areEqual(JSON.stringify(["git_github_read", ...RuntimeToolSessionTests.GIT_TOOLS]), JSON.stringify(listed));
    Assert.areEqual(JSON.stringify(RuntimeToolSessionTests.GIT_TOOLS.map(t => ({ content: [{ type: "text", text: t }], isError: false }))), JSON.stringify(answers));
  }

  @TestMethod
  public async asksThePersonForGitsCommitAndPushAndRunsNeitherUntilTheAnswerAllowsIt(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    const answers = new Map<string, (decision: PermissionDecision) => void>();
    let bothAsked: () => void = () => undefined;
    const asked = new Promise<void>(resolve => {
      bothAsked = resolve;
    });
    context.center.registerAnswerer("teamrun", { answerAsync: t => new Promise<PermissionDecision>(resolve => {
      answers.set(`${t.module} ${t.request.action}`, resolve);
      if (answers.size === 2)
        bothAsked();
    }) }, { write: () => undefined });
    const ran: string[] = [];
    const changes: ReadonlyArray<readonly [string, string]> = [["git_commit", "git.commit"], ["git_push", "git.push"]];
    for (const [name, action] of changes)
      context.registry.register("git", new ToolDescriptor({
        ...RuntimeToolSessionTests.descriptor(name, `Runs ${name}.`), hints: { isReadOnly: false }, risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
        isResumable: true
      }, [name]), {
        handleAsync: async t => {
          const answer = await t.requestPermissionAsync({ action, title: `Run ${name}`, details: [], risk: ToolRisk.Medium,
            options: [PermissionOption.AllowOnce, PermissionOption.Deny] });
          if (answer.decision !== PermissionDecision.AllowedOnce)
            throw new ToolFailureException(new ToolFailure(ToolFailureCode.Denied, "The person denied it."));
          ran.push(name);
          return new ToolResult([ToolContent.fromText(`${name} ran.`, null)]);
        }
      }, [name], { write: () => undefined });
    const session = new RuntimeToolSessions(context, []).open("c1/t1", "c1", "/work/project", "p1", "Ada", () => undefined);

    const commit = session.callToolAsync("git_commit", { message: "Say what the site is" }, new AbortController().signal);
    const push = session.callToolAsync("git_push", {}, new AbortController().signal);
    const first = await Promise.race([asked.then(() => "asked"), Promise.all([commit, push]).then(t => `answered unasked: ${JSON.stringify(t)}`)]);
    const unanswered = [...ran];
    answers.get("git git.commit")?.(PermissionDecision.Denied);
    answers.get("git git.push")?.(PermissionDecision.AllowedOnce);
    const results = [await commit, await push];
    session.end();

    Assert.areEqual("asked", first);
    Assert.areEqual(JSON.stringify(["git git.commit", "git git.push"]), JSON.stringify([...answers.keys()].sort()));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(unanswered));
    Assert.areEqual(JSON.stringify(["git_push"]), JSON.stringify(ran));
    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify(results.map(t => t["isError"])));
  }

  @TestMethod
  public async opensEachServedCallUnderAnIdOfItsOwnPassedToTheRegistryAsItsCallIdWhileItRunsSoTwoCallsAtOnceNameTheirOwnAndClosesItWhenItEnds(): Promise<void> {
    const context = RuntimeToolSessionTests.tools();
    const calls = new RecordingCalls();
    let bothStarted: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      bothStarted = resolve;
    });
    const during: unknown[] = [];
    context.registry.register("browser", new ToolDescriptor(RuntimeToolSessionTests.descriptor("browser_click", "Clicks."), ["browser_click"]), {
      handleAsync: async () => {
        if (calls.ids.length === 2)
          bothStarted();
        await started;
        during.push(calls.ids.map(t => calls.find(t)));
        return new ToolResult([ToolContent.fromText("Clicked.", null)]);
      }
    }, ["browser_click"], { write: () => undefined });
    const registered = context.openSession("c1/t1", {});
    const passed: (string | null)[] = [];
    const callAsync = registered.callAsync.bind(registered);
    registered.callAsync = (name, input, options) => {
      passed.push(!Object.isUndefined(options) && "callId" in options && Object.isString(options.callId) ? options.callId : null);
      return callAsync(name, input, options);
    };
    const session = new RuntimeToolSession(registered, null, new ManualTimer(), () => undefined, calls);

    await Promise.all([session.callToolAsync("browser_click", { ref: "e5" }, new AbortController().signal),
      session.callToolAsync("browser_click", { ref: "e7" }, new AbortController().signal)]);
    session.end();

    const both = [{ tool: "browser_click", input: { ref: "e5" } }, { tool: "browser_click", input: { ref: "e7" } }];
    Assert.areEqual(JSON.stringify([both, both]), JSON.stringify(during));
    Assert.areEqual(JSON.stringify([2, null, null]), JSON.stringify([new Set(calls.ids).size, ...calls.ids.map(t => calls.find(t))]));
    Assert.areEqual(JSON.stringify(calls.ids), JSON.stringify(passed));
  }

  private static tools(called: JsonObject[] = [], pageFailures: string[] = []): RegistryToolsContext {
    const context = new RegistryToolsContext("teamrun", { write: () => undefined }, RuntimeToolSessionTests.DECLARED);
    context.register({ ...RuntimeToolSessionTests.descriptor("teamrun_picture", "Draws a picture."), title: "Picture", outputSchema: { type: "object" } }, {
      handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromImage(RuntimeToolSessionTests.PICTURE, "image/png", null), ToolContent.fromText("A dot.", null)],
        { count: 1 }))
    });
    context.register(RuntimeToolSessionTests.descriptor("teamrun_broken", "Breaks."), {
      handleAsync: () => Promise.reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Unavailable, "The index is down.", "teamrun.down",
        [ToolContent.fromText("Try later.", null)])))
    });
    context.register({
      ...RuntimeToolSessionTests.descriptor("teamrun_plain", "Answers."), hints: { isDestructive: false, isOpenWorld: true }, isResumable: true
    }, { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("Done.", null)])) });
    context.registry.register("terminal", new ToolDescriptor(RuntimeToolSessionTests.descriptor("terminal_list", "Lists terminals."), ["terminal_list"]), {
      handleAsync: call => {
        called.push(call.bindings);
        return Promise.resolve(new ToolResult([ToolContent.fromText("No terminals.", null)]));
      }
    }, ["terminal_list"], { write: () => undefined });
    context.registry.register("other", new ToolDescriptor(RuntimeToolSessionTests.descriptor("other_tool", "Belongs elsewhere."), ["other_tool"]),
      { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("Elsewhere.", null)])) }, ["other_tool"], { write: () => undefined });
    context.registry.register("lookalike", new ToolDescriptor(RuntimeToolSessionTests.descriptor("terminal_spy", "Looks like Terminal's."), ["terminal_spy"]),
      { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("Spied.", null)])) }, ["terminal_spy"], { write: () => undefined });
    context.registry.register("computer-use", new ToolDescriptor(RuntimeToolSessionTests.descriptor("computer_list_apps", "Lists apps."), ["computer_list_apps"]),
      { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("Notes.", null)])) }, ["computer_list_apps"], { write: () => undefined });
    context.registry.register("lookalike", new ToolDescriptor(RuntimeToolSessionTests.descriptor("computer_spy", "Looks like computer use's."), ["computer_spy"]),
      { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("Spied.", null)])) }, ["computer_spy"], { write: () => undefined });
    context.registry.register("browser", new ToolDescriptor(RuntimeToolSessionTests.descriptor("browser_snapshot", "Reads the page."), ["browser_snapshot"]), {
      handleAsync: () => {
        const failure = pageFailures.shift();
        return failure === undefined ? Promise.resolve(new ToolResult([ToolContent.fromText("A page.", null)]))
          : Promise.reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Unavailable, "The page is closed.", failure, [])));
      }
    }, ["browser_snapshot"], { write: () => undefined });
    context.registry.register("git-github", new ToolDescriptor(RuntimeToolSessionTests.descriptor("git_github_read", "Reads an issue."), ["git_github_read"]),
      { handleAsync: () => Promise.resolve(new ToolResult([ToolContent.fromText("An issue.", null)])) }, ["git_github_read"], { write: () => undefined });
    return context;
  }

  private static registerFields(context: RegistryToolsContext, moduleId: string, name: string, content: readonly ToolContent[], structured: JsonObject): void {
    context.registry.register(moduleId, new ToolDescriptor({ ...RuntimeToolSessionTests.descriptor(name, `Shows ${name}.`), outputSchema: { type: "object" } }, [name]),
      { handleAsync: () => Promise.resolve(new ToolResult(content, structured)) }, [name], { write: () => undefined });
  }

  private static descriptor(name: string, description: string): IToolDescriptor {
    return {
      name,
      description,
      inputSchema: { type: "object" },
      hints: { isReadOnly: true },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      deadline: { default: RuntimeToolSessionTests.DEADLINE, maximum: 10_000 }
    };
  }
}

class RecordingCalls extends ServedCalls {
  public readonly ids: string[] = [];

  public override open(tool: string, input: JsonObject): string {
    const id = super.open(tool, input);
    this.ids.push(id);
    return id;
  }
}
