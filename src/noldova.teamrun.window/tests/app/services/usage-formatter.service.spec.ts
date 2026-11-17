/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { StatusBarItemState } from "@noldova/desktop.window";
import {
  ContextUsage, Message, MessageAuthor, MessageStatus, ObservedSettings, PlanUsage, PlanWindow, PlanWindowName, Provenance, ReplyUsage, RequestedSettings
} from "@noldova/teamrun.protocol";

import { UsageLevel } from "../../../src/app/enums/usage-level";
import type { ReplyStats } from "../../../src/app/models/reply-stats";
import { ClockService } from "../../../src/app/services/clock.service";
import { TimeFormatService } from "../../../src/app/services/time-format.service";
import { UsageFormatterService } from "../../../src/app/services/usage-formatter.service";
import { Resources } from "../../../src/resources";
import { FakeClock } from "../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("UsageFormatterService", () => {
  const now = new Date(2026, 9, 22, 9, 30);
  const at = (day: number, hour: number, minute: number): string => new Date(2026, 9, day, hour, minute).toISOString();
  const formatter = (): UsageFormatterService => {
    TestBed.configureTestingModule({ providers: [{ provide: ClockService, useValue: new FakeClock(now.getTime()) }] });
    return TestBed.inject(UsageFormatterService);
  };
  const reply = (usage: ReplyUsage | null, startedAt: string | null = "2026-10-22T08:00:00.000Z", endedAt: string | null = "2026-10-22T08:01:05.000Z"): Message =>
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", Object.isNull(endedAt) ? MessageStatus.Running : MessageStatus.Completed, [],
      new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null, usage), SampleData.timestamp, startedAt, endedAt);
  const ofKind = (kind: string, usage: ReplyUsage | null, observed: string | null = kind): Message =>
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], new Provenance("a1", new RequestedSettings(kind, null, null),
      new ObservedSettings(observed, null, null, "1.0"), "s1", false, null, null, usage), SampleData.timestamp, null, "2026-10-22T08:01:05.000Z");
  const rowsOf = (stats: ReplyStats | null): string[] => stats?.rows.map(t => `${t.isPart ? "  " : ""}${t.label}: ${t.value}`) ?? [];
  const plan = (...windows: PlanWindow[]): PlanUsage => new PlanUsage("claude", "a1", windows, "2026-10-22T09:00:00.000Z");
  const limits = (usage: UsageFormatterService, shown: PlanUsage): readonly (readonly unknown[])[] =>
    usage.limitsOf(shown).map(t => [t.label, t.percent, t.text, t.level, t.description]);

  it("rounds the context in use to a percent of the window, caps it at full, and places the compact point the same way", () => {
    const usage = formatter();

    expect([usage.contextPercent(new ContextUsage(86_400, 100_000, null)), usage.compactPercent(new ContextUsage(86_400, 100_000, null))]).toEqual([86, null]);
    expect([usage.contextPercent(new ContextUsage(250_000, 200_000, 180_000)), usage.compactPercent(new ContextUsage(250_000, 200_000, 180_000))]).toEqual([100, 90]);
  });

  it("says whose session holds how many tokens, and where it compacts only when the provider sends it", () => {
    const usage = formatter();

    expect(usage.contextDetail(new ContextUsage(172_000, 200_000, 180_000), "Ada")).toBe("Ada's session holds 172,000 of 200,000 tokens. It compacts at 90%.");
    expect(usage.contextDetail(new ContextUsage(9_500, 128_000, null), "Codex")).toBe("Codex's session holds 9,500 of 128,000 tokens.");
  });

  it("joins the reply's tokens, time and cost, and leaves out each figure the provider didn't send", () => {
    const usage = formatter();

    expect(usage.replyStats(reply(new ReplyUsage(12_345, 678, 0.0421, null)))).toBe("12,345 tokens in · 678 tokens out · 1m 5s · $0.04");
    expect(usage.replyStats(reply(new ReplyUsage(null, 40, 0.0031, null)))).toBe("40 tokens out · 1m 5s · $0.0031");
    expect(usage.replyStats(reply(new ReplyUsage(10, null, null, null), null))).toBe("10 tokens in");
    expect(usage.replyStats(reply(new ReplyUsage(null, null, 0, null), "2026-10-22T08:00:00.000Z", null))).toBe("$0.00");
  });

  it("shows a finished reply's time alone when its provider sent no tokens or cost, and nothing for a person or a reply still working", () => {
    const usage = formatter();

    expect(usage.replyStats(reply(null))).toBe("1m 5s");
    expect(usage.replyStats(reply(new ReplyUsage(null, null, null, new ContextUsage(1, 2, null))))).toBe("1m 5s");
    expect(usage.replyStats(SampleData.userMessage)).toBeNull();
    expect(usage.replyStats(reply(null, "2026-10-22T08:00:00.000Z", null))).toBeNull();
  });

  it("labels the stats button with compact tokens in and out, else the context percentage, else nothing", () => {
    const usage = formatter();
    const context = new ContextUsage(84_000, 200_000, null);

    expect([new ReplyUsage(260_412, 1_534, null, context), new ReplyUsage(999, null, null, null), new ReplyUsage(null, 1_250_000, null, null),
      new ReplyUsage(null, null, 0.5, context), new ReplyUsage(null, null, 0.5, null)].map(t => usage.statsOf(reply(t), null)?.label))
      .toEqual(["260K in · 1.5K out", "999 in", "1.3M out", "42% context", null]);
  });

  it("lists each reported figure once, the cache and new input under tokens in and reasoning under tokens out, then cost, context, time and model", () => {
    const usage = formatter();
    const stats = usage.statsOf(reply(new ReplyUsage(260_000, 1_500, 0.0031, new ContextUsage(84_000, 200_000, null), 200_000, 10_000, 600)), "gpt-5 · high");

    expect([stats?.note, rowsOf(stats)]).toEqual([null, ["Tokens in: 260,000", "  From cache: 200,000", "  Written to cache: 10,000", "  New: 50,000",
      "Tokens out: 1,500", "  Reasoning: 600", "Cost: $0.0031", "Context: 42% of 200,000 tokens", "Time worked: 1m 5s", "Model: gpt-5 · high"]]);
    expect(rowsOf(usage.statsOf(reply(new ReplyUsage(500, null, null, null, null, 120)), null))).toEqual(["Tokens in: 500", "  Written to cache: 120", "  New: 380", "Time worked: 1m 5s"]);
    expect(rowsOf(usage.statsOf(reply(new ReplyUsage(500, null, null, null, 200)), null))).toEqual(["Tokens in: 500", "  From cache: 200", "  New: 300", "Time worked: 1m 5s"]);
    expect(rowsOf(usage.statsOf(reply(new ReplyUsage(500, 10, null, null)), null))).toEqual(["Tokens in: 500", "Tokens out: 10", "Time worked: 1m 5s"]);
  });

  it("works out new input only for Claude and Codex, whose input holds the cache counts, and never below zero", () => {
    const usage = formatter();
    const cached = new ReplyUsage(1_000, 10, null, null, 900, 300);

    expect(["claude", "codex", "grok", "copilot"].map(t => rowsOf(usage.statsOf(ofKind(t, cached), null)).find(row => row.includes("New")) ?? null))
      .toEqual(["  New: 0", "  New: 0", null, null]);
    expect(rowsOf(usage.statsOf(ofKind("grok", cached, null), null)).slice(0, 4)).toEqual(["Tokens in: 1,000", "  From cache: 900", "  Written to cache: 300", "Tokens out: 10"]);
  });

  it("says no token counts were reported when neither tokens in nor out came, and keeps cache and reasoning counts as figures of their own then", () => {
    const usage = formatter();
    const stats = usage.statsOf(reply(new ReplyUsage(null, null, null, null, 40, null, 7)), null);

    expect([stats?.note, rowsOf(stats)]).toEqual([Resources.noTokensReportedText, ["From cache: 40", "Reasoning: 7", "Time worked: 1m 5s"]]);
    expect([usage.statsOf(reply(null), null)?.note, rowsOf(usage.statsOf(reply(null, null), null))]).toEqual([Resources.noTokensReportedText, []]);
    expect(usage.statsOf(SampleData.userMessage, null)).toBeNull();
  });

  it("lists the plan's windows in a fixed order with a time for a reset today and a date for a later one", () => {
    const usage = formatter();
    const windows = plan(
      new PlanWindow(PlanWindowName.Weekly, 41.6, at(27, 14, 0)),
      new PlanWindow(PlanWindowName.FiveHour, 12.2, at(22, 13, 5)),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 3, null));

    expect(usage.planLines(windows)).toEqual(["5-hour: 12% used, resets 1:05 PM", "Weekly: 42% used, resets Oct 27, 2026, 2:00 PM", "Monthly premium requests: 3% used, no reset time reported"]);
  });

  it("writes a reset in Noldova Desktop's time and date-and-time formats, as a 24-hour setting gives them", () => {
    const usage = formatter();
    const context = new FakeWindowPartContext();
    context.changeSetting("desktop.timeFormat", "HH:mm");
    context.changeSetting("desktop.dateTimeFormat", "d MMM yyyy, HH:mm");
    TimeFormatService.register(context);
    const windows = plan(new PlanWindow(PlanWindowName.Weekly, 91.6, at(23, 8, 0)), new PlanWindow(PlanWindowName.FiveHour, 80, at(22, 13, 5)));
    const later = plan(new PlanWindow(PlanWindowName.Weekly, 95, at(27, 14, 0)));
    const shown = [usage.planLines(windows), ...usage.limitsOf(windows).map(t => t.text), ...usage.limitsOf(later).map(t => t.text)];
    TimeFormatService.release(context);

    expect(shown).toEqual([["5-hour: 80% used, resets 13:05", "Weekly: 92% used, resets 23 Oct 2026, 08:00"], "20% left · 13:05", "8% left · 23 Oct, 08:00",
      "5% left · 27 Oct"]);
  });

  it("says a used-up provider is Used up with its reset in the app's time format, its weekday within a week and its date after, Used up alone with no reset, and nothing otherwise",
    () => {
      const usage = formatter();
      const usedUp = (until: string | null): PlanUsage => new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 100, until)], "2026-10-22T09:00:00.000Z", null,
        true, until);
      const context = new FakeWindowPartContext();
      const before = [usage.usedUpLabel(usedUp(at(22, 15, 0))), usage.usedUpLabel(usedUp(at(23, 8, 0))), usage.usedUpLabel(usedUp(at(27, 14, 0))),
        usage.usedUpLabel(usedUp(at(30, 14, 0))), usage.usedUpLabel(usedUp(null)), usage.usedUpLabel(plan(new PlanWindow(PlanWindowName.FiveHour, 100, at(22, 15, 0)))), usage.usedUpLabel(null)];
      context.changeSetting("desktop.timeFormat", "HH:mm");
      TimeFormatService.register(context);
      const twentyFour = [usage.usedUpLabel(usedUp(at(22, 15, 0))), usage.usedUpLabel(usedUp(at(23, 8, 0)))];
      TimeFormatService.release(context);

      expect(before).toEqual(["Used up, resets 3:00 PM", "Used up, resets Fri 8:00 AM", "Used up, resets Tue 2:00 PM", "Used up, resets Oct 30", "Used up", null, null]);
      expect(twentyFour).toEqual(["Used up, resets 15:00", "Used up, resets Fri 08:00"]);
    });

  it("names the limit a used-up plan used up and when it resets, from the plan's wait or else the window's reset, and nothing for a plan with room", () => {
    const usage = formatter();
    const usedUp = (until: string | null, ...windows: PlanWindow[]): PlanUsage => new PlanUsage("codex", "a1", windows, "2026-10-22T09:00:00.000Z", null, true, until);

    expect([
      usage.usedUpNote(usedUp(at(27, 9, 0), new PlanWindow(PlanWindowName.FiveHour, 30, at(22, 13, 0)), new PlanWindow(PlanWindowName.Weekly, 100, at(27, 14, 0)))),
      usage.usedUpNote(usedUp(null, new PlanWindow(PlanWindowName.FiveHour, 100, at(22, 15, 0)))),
      usage.usedUpNote(usedUp(at(22, 15, 0), new PlanWindow(PlanWindowName.FiveHour, 40, null))),
      usage.usedUpNote(usedUp(null)),
      usage.usedUpNote(plan(new PlanWindow(PlanWindowName.FiveHour, 100, at(22, 15, 0)))),
      usage.usedUpNote(null)
    ]).toEqual(["Weekly limit used up · resets Tue 9:00 AM", "5-hour limit used up · resets 3:00 PM", "Used up · resets 3:00 PM", "Used up", null, null]);
  });

  it("says how much of its most used window a provider has left, Used up once it is, and nothing for no usage or only unlimited or balance windows", () => {
    const usage = formatter();
    const usedUp = new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 100, null)], "2026-10-22T09:00:00.000Z", null, true, null);

    expect([usage.leftLabel(plan(new PlanWindow(PlanWindowName.Weekly, 41.6, null), new PlanWindow(PlanWindowName.FiveHour, 12.2, null))),
      usage.leftLabel(plan(new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, 30, 120))), usage.leftLabel(usedUp), usage.leftLabel(null), usage.leftLabel(plan()),
      usage.leftLabel(plan(new PlanWindow(PlanWindowName.Weekly, null, null, null, null, true))), usage.leftLabel(plan(new PlanWindow(PlanWindowName.Weekly, null, null, null, null, false, 5)))])
      .toEqual(["58% left", "75% left", "Used up", null, null, null, null]);
  });

  it("says a reset that has passed, or is now, as Was used up until its time, and one still ahead as Used up, resets", () => {
    const usage = formatter();

    expect([usage.usedUpState(at(22, 8, 0)), usage.usedUpState(at(20, 14, 0)), usage.usedUpState(at(22, 9, 30)), usage.usedUpState(at(22, 9, 31))])
      .toEqual(["Was used up until 8:00 AM", "Was used up until Oct 20, 2:00 PM", "Was used up until 9:30 AM", "Used up, resets 9:31 AM"]);
  });

  it("warns from a shown 75% of any window, not below it", () => {
    const usage = formatter();
    const rounded = plan(new PlanWindow(PlanWindowName.FiveHour, 74.6, null));

    expect(usage.isNearLimit(plan(new PlanWindow(PlanWindowName.FiveHour, 74.4, null), new PlanWindow(PlanWindowName.Weekly, 20, null)))).toBe(false);
    expect(usage.isNearLimit(plan(new PlanWindow(PlanWindowName.FiveHour, 10, null), new PlanWindow(PlanWindowName.Weekly, 75, null)))).toBe(true);
    expect([usage.planLines(rounded), usage.isNearLimit(rounded)]).toEqual([["5-hour: 75% used, no reset time reported"], true]);
  });

  it("warns from 75% of a count window's allowance when the provider gives no percent", () => {
    const usage = formatter();
    const unlimited = new PlanWindow(PlanWindowName.MonthlyCompletions, null, null, null, null, true);

    expect(usage.isNearLimit(plan(new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, 74, 100), unlimited))).toBe(false);
    expect(usage.isNearLimit(plan(new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, 75, 100), unlimited))).toBe(true);
    expect(usage.isNearLimit(plan(new PlanWindow(PlanWindowName.MonthlyChatRequests, 10, null, 45, 50)))).toBe(false);
  });

  it("puts the first two windows in the status bar, the provider and every window in its tooltip, and opens the providers on a click", () => {
    const usage = formatter();
    const state = usage.planStatus(plan(
      new PlanWindow(PlanWindowName.WeeklyOpus, 5, null),
      new PlanWindow(PlanWindowName.Weekly, 30, null),
      new PlanWindow(PlanWindowName.FiveHour, 64, at(22, 11, 0))), "Claude Code · Work");

    expect(state).toEqual(new StatusBarItemState("5h 64% · Week 30%", {
      icon: "data_usage",
      tooltip: "Claude Code · Work. 5-hour: 64% used, resets 11:00 AM. Weekly: 30% used, no reset time reported. Weekly Opus: 5% used, no reset time reported.",
      command: "teamrun.showProviders"
    }));
  });

  it("swaps the status bar icon for a warning and says so first near the limit, from 75%", () => {
    const usage = formatter();
    const stateOf = (percent: number): readonly unknown[] => {
      const state = usage.planStatus(plan(new PlanWindow(PlanWindowName.FiveHour, percent, null)), "Claude Code");
      return [state.text, state.icon, state.tooltip];
    };

    expect([74, 75, 92].map(t => stateOf(t))).toEqual([["5h 74%", "data_usage", "Claude Code. 5-hour: 74% used, no reset time reported."],
      ["5h 75%", "warning", "Claude Code. Near the plan limit. 5-hour: 75% used, no reset time reported."],
      ["5h 92%", "warning", "Claude Code. Near the plan limit. 5-hour: 92% used, no reset time reported."]]);
  });

  it("shows a count window's used of allowance beside its percent when both are given, and the count alone when the percent isn't", () => {
    const usage = formatter();
    const state = usage.planStatus(plan(
      new PlanWindow(PlanWindowName.MonthlyChatRequests, null, at(22, 23, 0), 12, 50),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 40.5, at(31, 17, 0), 1_215.5, 3_000)), "GitHub Copilot");

    expect([state.text, state.tooltip]).toEqual(["Premium 1,215.5/3,000 (41%) · Chat 12/50",
      "GitHub Copilot. Monthly premium requests: 1,215.5 of 3,000 used (41%), resets Oct 31, 2026, 5:00 PM. Monthly chat requests: 12 of 50 used, resets 11:00 PM."]);
  });

  it("shows an unlimited window as Unlimited and a balance as what is left, with no reset for either", () => {
    const usage = formatter();
    const copilot = usage.planStatus(plan(
      new PlanWindow(PlanWindowName.MonthlyCompletions, null, at(31, 17, 0), null, null, true),
      new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, null, null, true),
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 95, null, 285, 300)), "GitHub Copilot");
    const codex = usage.planStatus(plan(new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, 12.5),
      new PlanWindow(PlanWindowName.FiveHour, 20, null)), "Codex");

    expect([copilot.text, copilot.icon, copilot.tooltip]).toEqual(["Premium 285/300 (95%) · Chat Unlimited", "warning",
      "GitHub Copilot. Near the plan limit. Monthly premium requests: 285 of 300 used (95%), no reset time reported. Monthly chat requests: Unlimited. "
      + "Monthly completions: Unlimited."]);
    expect([codex.text, codex.icon, codex.tooltip]).toEqual(["5h 20% · Credits 12.5 left", "data_usage",
      "Codex. 5-hour: 20% used, no reset time reported. Credits: 12.5 left."]);
  });

  it("puts a window used in full first in the status bar, ahead of unlimited ones, and keeps the tooltip in the windows' order", () => {
    const usage = formatter();
    const copilot = usage.planStatus(plan(
      new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, null, null, true),
      new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, null, null, true),
      new PlanWindow(PlanWindowName.Quota, 100, at(31, 17, 0)),
      new PlanWindow(PlanWindowName.MonthlyCredits, null, null, 1_000, 1_000)), "GitHub Copilot");
    const claude = usage.planStatus(plan(new PlanWindow(PlanWindowName.FiveHour, 99.4, null), new PlanWindow(PlanWindowName.Weekly, 30, null),
      new PlanWindow(PlanWindowName.WeeklyOpus, 99.6, null)), "Claude Code");

    expect([copilot.text, copilot.icon, copilot.tooltip]).toEqual(["Credits month 1,000/1,000 · Quota 100%", "warning",
      "GitHub Copilot. Near the plan limit. Monthly premium requests: Unlimited. Monthly chat requests: Unlimited. Monthly credits: 1,000 of 1,000 used, "
      + "no reset time reported. Quota: 100% used, resets Oct 31, 2026, 5:00 PM."]);
    expect(claude.text).toBe("Opus week 100% · 5h 99%");
  });

  it("shows the first two windows as meters of their short label and what's left, with the reset on the meter only when the window is near its limit: " +
    "a time today, a date and time within a day and a date after that; one meter for one window and none for none", () => {
    const usage = formatter();
    const soon = plan(new PlanWindow(PlanWindowName.FiveHour, 80, at(22, 13, 5)), new PlanWindow(PlanWindowName.Weekly, 91.6, at(23, 8, 0)));
    const later = plan(new PlanWindow(PlanWindowName.Weekly, 95, at(27, 14, 0)), new PlanWindow(PlanWindowName.FiveHour, 3, null));

    expect(limits(usage, soon)).toEqual([["5h", 20, "20% left · 1:05 PM", UsageLevel.Warning, "5-hour: 80% used, resets 1:05 PM"],
      ["Week", 8, "8% left · Oct 23, 8:00 AM", UsageLevel.Critical, "Weekly: 92% used, resets Oct 23, 2026, 8:00 AM"]]);
    expect(limits(usage, later)).toEqual([["5h", 97, "97% left", UsageLevel.Normal, "5-hour: 3% used, no reset time reported"],
      ["Week", 5, "5% left · Oct 27", UsageLevel.Critical, "Weekly: 95% used, resets Oct 27, 2026, 2:00 PM"]]);
    expect(limits(usage, plan(new PlanWindow(PlanWindowName.Weekly, 41.6, at(23, 8, 0)))))
      .toEqual([["Week", 58, "58% left", UsageLevel.Normal, "Weekly: 42% used, resets Oct 23, 2026, 8:00 AM"]]);
    expect(limits(usage, plan())).toEqual([]);
  });

  it("picks the windows the status bar shows, a used-up one first, for a provider's own windows such as Copilot's premium requests and quota", () => {
    const usage = formatter();
    const copilot = plan(new PlanWindow(PlanWindowName.MonthlyPremiumRequests, null, null, null, null, true),
      new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, null, null, true), new PlanWindow(PlanWindowName.Quota, 100, null),
      new PlanWindow(PlanWindowName.MonthlyCredits, null, null, 1_000, 1_000));
    const claude = plan(new PlanWindow(PlanWindowName.FiveHour, 99.4, null), new PlanWindow(PlanWindowName.Weekly, 30, null), new PlanWindow(PlanWindowName.WeeklyOpus, 99.6, null));
    const premium = plan(new PlanWindow(PlanWindowName.MonthlyPremiumRequests, 42, null), new PlanWindow(PlanWindowName.MonthlyChatRequests, null, null, null, null, true));

    expect(limits(usage, copilot)).toEqual([["Credits month", 0, "0 of 1,000 left", UsageLevel.Critical, "Monthly credits: 1,000 of 1,000 used, no reset time reported"],
      ["Quota", 0, "0% left", UsageLevel.Critical, "Quota: 100% used, no reset time reported"]]);
    expect(limits(usage, claude).map(t => t[0])).toEqual(["Opus week", "5h"]);
    expect(limits(usage, premium)).toEqual([["Premium", 58, "58% left", UsageLevel.Normal, "Monthly premium requests: 42% used, no reset time reported"],
      ["Chat", null, "Unlimited", UsageLevel.Normal, "Monthly chat requests: Unlimited"]]);
    for (const shown of [copilot, claude, premium])
      expect(usage.limitsOf(shown).map(t => t.label).join(" ")).toBe(usage.planStatus(shown, "Provider").text.split(" · ").map(t => t.replace(/ [^ ]+$/u, "")).join(" "));
  });

  it("marks a meter as a warning from a shown 75% and critical from 90%, or from those shares of a count's allowance, and shows an unlimited window or a " +
    "balance as words with no bar", () => {
    const usage = formatter();
    const levelOf = (percent: number): readonly unknown[] | undefined => limits(usage, plan(new PlanWindow(PlanWindowName.FiveHour, percent, null)))[0]?.slice(1);
    const counted = (used: number): unknown => limits(usage, plan(new PlanWindow(PlanWindowName.Weekly, null, null, used, 300)))[0]?.[3];
    const words = plan(new PlanWindow(PlanWindowName.FiveHour, null, at(22, 13, 5), null, null, true),
      new PlanWindow(PlanWindowName.Weekly, null, at(23, 8, 0), null, null, false, 12.5));

    expect([74, 74.4, 74.6, 75, 89, 89.4, 89.6, 90, 100].map(t => levelOf(t))).toEqual([
      [26, "26% left", UsageLevel.Normal, "5-hour: 74% used, no reset time reported"], [26, "26% left", UsageLevel.Normal, "5-hour: 74% used, no reset time reported"],
      [25, "25% left", UsageLevel.Warning, "5-hour: 75% used, no reset time reported"], [25, "25% left", UsageLevel.Warning, "5-hour: 75% used, no reset time reported"],
      [11, "11% left", UsageLevel.Warning, "5-hour: 89% used, no reset time reported"], [11, "11% left", UsageLevel.Warning, "5-hour: 89% used, no reset time reported"],
      [10, "10% left", UsageLevel.Critical, "5-hour: 90% used, no reset time reported"], [10, "10% left", UsageLevel.Critical, "5-hour: 90% used, no reset time reported"],
      [0, "0% left", UsageLevel.Critical, "5-hour: 100% used, no reset time reported"]]);
    expect([0, 222, 225, 267, 270].map(t => counted(t))).toEqual([UsageLevel.Normal, UsageLevel.Normal, UsageLevel.Warning, UsageLevel.Warning, UsageLevel.Critical]);
    expect(limits(usage, plan(new PlanWindow(PlanWindowName.Weekly, null, null, 225, 300))))
      .toEqual([["Week", 25, "75 of 300 left", UsageLevel.Warning, "Weekly: 225 of 300 used, no reset time reported"]]);
    expect(limits(usage, words)).toEqual([["5h", null, "Unlimited", UsageLevel.Normal, "5-hour: Unlimited"], ["Week", null, "12.5 left", UsageLevel.Normal, "Weekly: 12.5 left"]]);
  });

  it("lists the windows the Limits column doesn't show, in the fixed order, for the account's details", () => {
    const usage = formatter();

    expect(usage.otherLines(plan(new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, 12.5), new PlanWindow(PlanWindowName.Weekly, 20, null),
      new PlanWindow(PlanWindowName.WeeklyOpus, 5, null), new PlanWindow(PlanWindowName.FiveHour, 10, null))))
      .toEqual(["Weekly Opus: 5% used, no reset time reported", "Credits: 12.5 left"]);
    expect(usage.otherLines(plan(new PlanWindow(PlanWindowName.FiveHour, 10, null), new PlanWindow(PlanWindowName.Weekly, 20, null), new PlanWindow(PlanWindowName.WeeklyOpus, 100, null))))
      .toEqual(["Weekly: 20% used, no reset time reported"]);
    expect(usage.otherLines(plan(new PlanWindow(PlanWindowName.FiveHour, 10, null)))).toEqual([]);
  });

  it("says No usage reported for a provider that reports no windows, and hides the item while no figures are known or a read named only the plan", () => {
    const usage = formatter();

    expect(usage.planStatus(plan(), "Antigravity")).toEqual(new StatusBarItemState("No usage reported", {
      icon: "data_usage",
      tooltip: "Antigravity. No usage reported.",
      command: "teamrun.showProviders"
    }));
    expect(usage.planLines(plan())).toEqual(["No usage reported"]);
    expect(usage.planStatus(null, "Codex")).toBe(UsageFormatterService.hidden);
    expect(usage.planStatus(new PlanUsage("copilot", "a2", [], "2026-10-22T09:00:00.000Z", "free"), "GitHub Copilot")).toBe(UsageFormatterService.hidden);
    expect(usage.planStatus(new PlanUsage("copilot", "a2", [new PlanWindow(PlanWindowName.Quota, 10, null)], "2026-10-22T09:00:00.000Z", "pro"), "GitHub Copilot").text)
      .toBe("Quota 10%");
    expect([UsageFormatterService.hidden.text, UsageFormatterService.hidden.isHidden]).toEqual(["Plan usage", true]);
  });
});
