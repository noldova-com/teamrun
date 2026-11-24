/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import {
  AuthStatus,
  ContextUsage,
  ConversationMember,
  Department,
  Harness,
  MessageStatus,
  NodeType,
  Organization,
  OrganizationParent,
  PlanUsage,
  PlanWindow,
  PlanWindowName,
  Provider,
  ProviderIdentity,
  ReplyUsage,
  Teammate,
  TeammatePlacement,
  TeammateUsage
} from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class TeammatesCommandTests {
  @TestMethod
  public async listsEachTeammatesProviderAccountModelChatsAnsweringAndUsage(): Promise<void> {
    const context = await TeammatesCommandTests.activateAsync();

    const result = await context.runAsync("teamrun.listTeammates");

    Assert.areEqual([
      "t1  Alice  Provider  Work (dev@example.com)  gpt-5  high  chats: Release (c1), Notes (c2)  answering",
      "  role: Review",
      "  last reply in Release (c1): 1200 input tokens, 300 output tokens, $0.0200, context 4000 of 200000 tokens",
      "  last reply in chat c3: 10 input tokens",
      "  plan: FiveHour 40% used, Weekly",
      "  in Acme: the Devs department, reports to the person",
      "t2  Chat GPT  Provider  Work (dev@example.com)  (none)  (none)  chats: Release (c1)  idle",
      "  plan: FiveHour 40% used, Weekly",
      "  in Acme: the Devs department, reports to Alice",
      "t3  Bob  Provider  (deleted provider)  (none)  (none)  no chats  idle",
      "t4  Dana  Provider  Home  (none)  (none)  chats: Scratch (c4)  idle",
      "  in Acme: the Devs department, reports to Alice",
      "t5  Eve  Provider  Pilot (octo)  (none)  (none)  no chats  idle",
      "t6  Finn  Provider  Desk (Account not reported)  (none)  (none)  no chats  idle"
    ].join("\n"), result.text);
  }

  @TestMethod
  public async givesTheSameFieldsInItsJsonWithThePlanItsPlanReadNamesForAnAccountThatNamesNoneLeavingOutWhatTheProviderDoesNotReport(): Promise<void> {
    const context = await TeammatesCommandTests.activateAsync();

    const rows = (await context.runAsync("teamrun.listTeammates")).value as Record<string, JsonValue>[];

    Assert.areEqual(JSON.stringify({
      id: "t1", name: "Alice", role: "Review", harness: "Provider",
      provider: { id: "a1", kind: "codex", label: "Work", email: "dev@example.com", plan: "plus", organization: "Acme" },
      model: "gpt-5", effort: "high", chats: [{ id: "c1", title: "Release" }, { id: "c2", title: "Notes" }], answering: true,
      usage: [{ chatId: "c1", inputTokens: 1200, outputTokens: 300, costUsd: 0.02, contextTokens: 4000, contextWindowTokens: 200000 }, { chatId: "c3", inputTokens: 10 }],
      planWindows: [{ name: "FiveHour", usedPercent: 40, unlimited: false }, { name: "Weekly", used: 2, allowance: 10, unlimited: false }],
      organizations: [{ id: "o1", name: "Acme", department: "Devs", manager: null }]
    }), JSON.stringify(rows[0]));
    Assert.areEqual(JSON.stringify([{ id: "o1", name: "Acme", department: "Devs", manager: { id: "t1", name: "Alice" } }]), JSON.stringify(rows[3]?.["organizations"]));
    Assert.areEqual(JSON.stringify([{ chatId: "c1" }]), JSON.stringify(rows[1]!["usage"]));
    Assert.areEqual(JSON.stringify({
      id: "t3", name: "Bob", role: null, harness: "Provider", provider: null, model: null, effort: null, chats: [], answering: false, usage: [], planWindows: [],
      organizations: []
    }), JSON.stringify(rows[2]));
    Assert.areEqual(JSON.stringify({ id: "a2", kind: "claude", label: "Home" }), JSON.stringify(rows[3]!["provider"]));
    Assert.areEqual(JSON.stringify({ id: "a3", kind: "copilot", label: "Pilot", userName: "octo", plan: "pro" }), JSON.stringify(rows[4]!["provider"]));
    Assert.areEqual(JSON.stringify({ id: "a4", kind: "codex", label: "Desk" }), JSON.stringify(rows[5]!["provider"]));
    Assert.isFalse(JSON.stringify(rows).includes("/profiles/"));
  }

  private static async activateAsync(): Promise<RecordingCliContext> {
    const time = SampleData.time;
    const work = new Provider("a1", "codex", "Work", "/profiles/a1", AuthStatus.LoggedIn, new ProviderIdentity("dev@example.com", "plus", "Acme"), null, null, null,
      time);
    const home = new Provider("a2", "claude", "Home", "/profiles/a2", AuthStatus.LoggedOut, null, null, null, null, time);
    const pilot = new Provider("a3", "copilot", "Pilot", "/profiles/a3", AuthStatus.LoggedIn, new ProviderIdentity(undefined, "", undefined, "user", "octo"),
      null, null, null, time);
    const desk = new Provider("a4", "codex", "Desk", "/profiles/a4", AuthStatus.LoggedIn, null, null, null, null, time);
    const bob = new Teammate("t3", "Bob", null, "gone", Harness.Provider, null, null, time, time);
    const dana = new Teammate("t4", "Dana", null, "a2", Harness.Provider, null, null, time, time);
    const eve = new Teammate("t5", "Eve", null, "a3", Harness.Provider, null, null, time, time);
    const finn = new Teammate("t6", "Finn", null, "a4", Harness.Provider, null, null, time, time);
    const windows = [new PlanWindow(PlanWindowName.FiveHour, 40, null), new PlanWindow(PlanWindowName.Weekly, null, null, 2, 10)];
    const member = (conversationId: string, teammateId: string): JsonValue => new ConversationMember(conversationId, teammateId, time, null, false).toJson();
    const acme = new Organization("o1", "Acme", null, 0, time, time, [new NodeType("u1", "Team", null, null, time, time)],
      [new Department("d1", "Devs", "u1", OrganizationParent.person, "t1", 0, time, time)],
      [new TeammatePlacement("t1", OrganizationParent.department("d1"), 0), new TeammatePlacement("t2", OrganizationParent.department("d1"), 1),
        new TeammatePlacement("t4", OrganizationParent.teammate("t1"), 0)]);
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.teammateList", () => [SampleData.alice, SampleData.chat, bob, dana, eve, finn].map(t => t.toJson()))
      .answer("teamrun.providerList", () => [work.toJson(), home.toJson(), pilot.toJson(), desk.toJson()])
      .answer("teamrun.projectList", () => SampleData.listed.map(t => t.toJson()))
      .answer("teamrun.conversationList", t => [[SampleData.release], [SampleData.notes], [SampleData.scratch]][["p1", "p2", null].indexOf(
        (t as { projectId: string | null }).projectId)]!.map(u => u.toJson()))
      .answer("teamrun.conversationListMembers", t => ({ c1: [member("c1", "t1"), member("c1", "t2")], c2: [member("c2", "t1")], c4: [member("c4", "t4")] })[
        (t as { chatId: "c1" | "c2" | "c4" }).chatId])
      .answer("teamrun.messageListOpen", () => [SampleData.reply("m9", "c1", 4, MessageStatus.Running, [], SampleData.alice).toJson()])
      .answer("teamrun.teammateUsageList", () => [
        new TeammateUsage("t1", "c1", "m8", time, time, new ReplyUsage(1200, 300, 0.02, new ContextUsage(4000, 200000, null))).toJson(),
        new TeammateUsage("t2", "c1", "m7", null, null, new ReplyUsage(null, null, null, null)).toJson(),
        new TeammateUsage("t1", "c3", "m6", time, time, new ReplyUsage(10, null, null, null)).toJson()
      ])
      .answer("teamrun.planUsageList", () => [new PlanUsage("codex", "a1", windows, time, "free").toJson(), new PlanUsage("copilot", "a3", [], time, "pro").toJson(),
        new PlanUsage("claude", "a1", [new PlanWindow(PlanWindowName.WeeklyOpus, 90, null)], time).toJson()])
      .answer("teamrun.organizationList", () => [acme.toJson()]);
    return context;
  }
}
