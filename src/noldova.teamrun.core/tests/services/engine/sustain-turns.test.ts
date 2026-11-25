/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { SqlQuery } from "@noldova/context.data.sql";
import { ConversationEngine, OwnSummaryUnansweredException, Resources, SessionCarry, TurnDetail, TurnOutcome, UsageLimit } from "@noldova/teamrun.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ContextUsage, type Conversation, ConversationIdParams, ConversationMemberParams, DetailKind, EventName, Harness, Message, MessageDelivery, MessageIdParams, MessageListParams, MessageSendParams, MessageStatus, PlanWindow,
  type MessageDetail, PlanWindowName, ProviderEnabledParams, ProviderIdParams, ProviderKind, type Provider, ReplyUsage, RequestedSettings, type Teammate, TeammateCreateParams, TeammateFallback, TeammateUpdateParams, WaitingMessageAddParams }
  from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class SustainTurnsTests {
  private static readonly hour: number = 3_600_000;

  @TestMethod
  public async movesTheTurnAfterALimitToTheFirstFallbackAndBackOnceTheLimitResets(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.timer.jump(SustainTurnsTests.hour + 1);
    await SustainTurnsTests.ask(host, conversation, bob, "three");
    await SustainTurnsTests.ask(host, conversation, bob, "four");

    const requests = host.adapter.requests;
    Assert.areEqual([work.id, spare.id, spare.id, work.id, work.id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("model-b,fake-small,fake-small,model-b,model-b", requests.map(t => String(t.requested.model)).join(","));
    Assert.areEqual("null,null,session-2,null,session-4", requests.map(t => String(t.resumeNativeSessionId)).join(","));
    const notes = await SustainTurnsTests.notesAsync(host, conversation);
    Assert.areEqual([Resources.formatSustainMoved("Fake provider", "Spare", "fake-small", "Work"),
      Resources.formatSustainReturned("Fake provider", "Work", "model-b")].join("|"), notes.join("|"));
  }

  @TestMethod
  public async resumesTheSameSessionUnderTheOtherAccountOfTheSameProviderAndCarriesItBackOnTheReturn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const carried: string[] = [];
    host.adapter.carrySession = (from, to, session): Promise<SessionCarry> => {
      carried.push(`${from?.id}>${to.id}|${session}`);
      return Promise.resolve(SessionCarry.Carried);
    };
    host.adapter.detailTexts = ["The work so far."];
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.timer.jump(SustainTurnsTests.hour + 1);
    await SustainTurnsTests.ask(host, conversation, bob, "three");

    const requests = host.adapter.requests;
    Assert.areEqual([work.id, spare.id, spare.id, work.id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("null,session-1,session-1,session-1", requests.map(t => String(t.resumeNativeSessionId)).join(","));
    Assert.areEqual(Resources.formatSustainContinued("The work so far."), requests[1]?.prompt);
    Assert.areEqual([`${work.id}>${spare.id}|session-1`, `${spare.id}>${work.id}|session-1`].join(","), carried.join(","));
    Assert.areEqual([Resources.formatSustainKept("Fake provider", "Spare", "fake-small", "Work"),
      Resources.formatSustainReturned("Fake provider", "Work", "model-b")].join("|"), (await SustainTurnsTests.notesAsync(host, conversation)).join("|"));
    Assert.areEqual(work.id, (await host.conversations.findMemberAsync(new ConversationMemberParams(conversation.id, bob.id)))?.sessionProviderId);
  }

  @TestMethod
  @TestData("Held")
  @TestData("Refused")
  @TestData("Unread")
  public async handsOverToANewSessionWhereTheSessionIsStillHeldRefusedOrItsCopyDoesntReadBack(carry: string): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const result = carry === "Held" ? SessionCarry.Held : carry === "Refused" ? SessionCarry.Refused : SessionCarry.Unread;
    host.adapter.carrySession = (): Promise<SessionCarry> => Promise.resolve(result);
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    const requests = host.adapter.requests;
    Assert.areEqual([work.id, spare.id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("null,null", requests.map(t => String(t.resumeNativeSessionId)).join(","));
    const note = carry === "Held" ? Resources.formatSustainHeld("Fake provider", "Spare", "fake-small", "Work")
      : Resources.formatSustainMoved("Fake provider", "Spare", "fake-small", "Work");
    Assert.areEqual(note, (await SustainTurnsTests.notesAsync(host, conversation)).join("|"));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async carriesNoSessionForAProviderThatCarriesNoneOrHasNoWayToCarryOne(carriesSessions: boolean): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const carried: string[] = [];
    host.adapter.descriptor = ProviderKind.fromJson({ ...host.adapter.descriptor.toJson(), carriesSessions });
    if (!carriesSessions)
      host.adapter.carrySession = (from, to, session): Promise<SessionCarry> => {
        carried.push(`${from?.id}>${to.id}|${session}`);
        return Promise.resolve(SessionCarry.Carried);
      };
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual(0, carried.length);
    Assert.areEqual("null,null", host.adapter.requests.map(t => String(t.resumeNativeSessionId)).join(","));
    Assert.areEqual([work.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
  }

  @TestMethod
  public async keepsWithEachMoveNoteTheFirstPromptItsNewSessionWasSentAndNoneWithTheNoteOfAChainWithNoEntryLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.timer.jump(SustainTurnsTests.hour + 1);
    await SustainTurnsTests.ask(host, conversation, bob, "three");
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "four");

    const requests = host.adapter.requests;
    Assert.areEqual([work.id, spare.id, spare.id, work.id, work.id, spare.id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("null,null,session-2,null,session-4,null", requests.map(t => String(t.resumeNativeSessionId)).join(","));
    const payloads = (await SustainTurnsTests.sustainDetailsAsync(host, conversation)).map(t => SustainTurnsTests.objectOf(t.payload));
    Assert.areEqual([1, 3, 5].map(t => requests[t]?.prompt ?? null).map(t => String(t)).join("|"),
      payloads.map(t => String(t[Resources.sustainHandoverField])).join("|"));
    Assert.areEqual("undefined,undefined,undefined", payloads.map(t => String(t[Resources.sustainStoppedField])).join(","));
    Assert.areEqual("undefined,undefined,undefined", payloads.map(t => String(t[Resources.sustainReadsField])).join(","));
    for (const carried of payloads.slice(0, 3).map(t => t[Resources.sustainCarriedField])) {
      Assert.isTrue(Array.isArray(carried) && carried.length > 0);
      Assert.isTrue(Array.isArray(carried) && String(carried.at(-1)).startsWith(Resources.formatHandoverCarriedAnswer(true, false) ?? String.empty));
    }
    Assert.isTrue(requests[1]?.prompt.includes("one") ?? false);
    Assert.isTrue(requests[3]?.prompt.includes("three") ?? false);
  }

  @TestMethod
  public async keepsALimitThroughARestartOfTheEngine(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    await host.engine.shutdown();
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates, host.registry,
      host.events, null, undefined, null, undefined, host.tasks, null, null, null, null, null, null, undefined, undefined, host.timer);

    await engine.sendAsync(new MessageSendParams(conversation.id, "@Bob two", null, null, [], [bob.id]));
    await engine.waitForIdle();
    await engine.shutdown();

    Assert.areEqual([work.id, spare.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
  }

  @TestMethod
  public async resumesASessionKeptBeforeItsAccountWasOnTheTeammatesOwnAccount(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    await host.conversations.setMemberSessionAsync(new ConversationMemberParams(conversation.id, bob.id), "kept-session", false);

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("kept-session", host.adapter.requests[1]?.resumeNativeSessionId);
    Assert.areEqual(0, (await SustainTurnsTests.notesAsync(host, conversation)).length);
  }

  @TestMethod
  public async keepsTheTurnOnItsOwnAccountAfterALimitWhileSustainIsOff(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, false);
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(0, (await SustainTurnsTests.notesAsync(host, conversation)).length);
  }

  @TestMethod
  public async movesNothingAfterAFailureThatIsNotAUsageLimit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "The fixture failed";

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.error = null;
    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(0, (await SustainTurnsTests.notesAsync(host, conversation)).length);
  }

  @TestMethod
  public async writesAReplyStoppedAtAUsageLimitAsOneLineNamingTheAccountAndItsResetOnceAPlanReadingGivesIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, false);
    const reset = new Date(host.timer.now() + SustainTurnsTests.hour).toISOString();
    host.adapter.limits.set(work.id, new UsageLimit(reset));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    const before = await SustainTurnsTests.errorsAsync(host, conversation);
    await host.adapter.lastListener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.FiveHour, 100, reset)], new Date(host.timer.now()).toISOString());

    const resets = Resources.formatUsageLimitResets(Resources.formatSustainResetTime(reset, new Date()));
    const stopped = Resources.formatUsageLimitStopped(SustainTurnsTests.stopped("Work"), resets);
    Assert.areEqual([stopped, Resources.formatUsageLimitStopped(SustainTurnsTests.stopped("Work"), null)].join("|"), before.join("|"));
    Assert.areEqual([stopped, stopped].join("|"), (await SustainTurnsTests.errorsAsync(host, conversation)).join("|"));
    const payloads = (await SustainTurnsTests.repliesAsync(host, conversation)).flatMap(t => t.details.filter(d => d.kind === DetailKind.Error))
      .map(t => SustainTurnsTests.objectOf(t.payload));
    Assert.areEqual("true,true", payloads.map(t => String(t[Resources.sustainStoppedField])).join(","));
  }

  @TestMethod
  public async staysOnItsOwnAccountWhenEveryFallbackIsOutToo(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    const spareOnly = await host.teammates.createAsync(new TeammateCreateParams("Sam", "Implement", spare.id, Harness.Provider, "model-s", "low"));
    await SustainTurnsTests.ask(host, conversation, spareOnly, "fills the spare");
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([spare.id, work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    const now = new Date(host.timer.now());
    const allOut = SustainTurnsTests.allOut("Work", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), null, now, true),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Spare"), null, now, false)]);
    Assert.areEqual([Resources.formatUsageLimitStopped(SustainTurnsTests.stopped("Spare"), null), allOut, allOut].join("|"),
      (await SustainTurnsTests.errorsAsync(host, conversation)).join("|"));
    Assert.areEqual(0, (await SustainTurnsTests.notesAsync(host, conversation)).length);
  }

  @TestMethod
  public async endsALimitWithoutAResetAtThePlanReadAfterItThatShowsRoomAndNotAtAnEarlierOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.timer.jump(1000);
    host.planUsage.record("fake", work.id, [new PlanWindow(PlanWindowName.FiveHour, 40, null)], new Date(500).toISOString());
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);

    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.timer.jump(1000);
    host.planUsage.record("fake", work.id, [new PlanWindow(PlanWindowName.FiveHour, 100, null)], new Date(1500).toISOString());
    await SustainTurnsTests.ask(host, conversation, bob, "three");
    host.planUsage.record("fake", work.id, [new PlanWindow(PlanWindowName.FiveHour, 60, null)], new Date(1800).toISOString());
    await SustainTurnsTests.ask(host, conversation, bob, "four");

    Assert.areEqual([work.id, spare.id, spare.id, spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
  }

  @TestMethod
  public async movesToTheFallbackWhosePlanResetsSoonestWhenTheTeammateAsksForThat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const soon = await host.createProviderAsync("fake", "Soon");
    const fallbacks = [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(soon.id, "fake-large", "high")];
    host.planUsage.record("fake", spare.id, [new PlanWindow(PlanWindowName.FiveHour, 10, new Date(5 * SustainTurnsTests.hour).toISOString())], new Date(0).toISOString());
    host.planUsage.record("fake", soon.id, [new PlanWindow(PlanWindowName.FiveHour, 90, new Date(SustainTurnsTests.hour).toISOString())], new Date(0).toISOString());
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks, resetsSoonestFirst: false }));
    await SustainTurnsTests.ask(host, conversation, bob, "one");

    await SustainTurnsTests.ask(host, conversation, bob, "in list order");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { resetsSoonestFirst: true }));
    await SustainTurnsTests.ask(host, conversation, bob, "soonest first");

    Assert.areEqual([work.id, spare.id, spare.id, soon.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual("fake-large", host.adapter.requests[3]?.requested.model);
  }

  @TestMethod
  public async continuesALimitedReplyOnTheNextEntryAheadOfAQueuedMessageWithWhatItWrote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    const gate = Promise.withResolvers<void>();
    host.adapter.holdTurn = (): Promise<void> => {
      host.adapter.holdTurn = null;
      return gate.promise;
    };
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob one", null, null, [], [bob.id]));
    await host.adapter.requested(1);
    await host.engine.addWaitingAsync(new WaitingMessageAddParams(new MessageSendParams(conversation.id, "two", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id),
      MessageDelivery.Queue));
    gate.resolve();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();

    const requests = host.adapter.requests;
    Assert.areEqual([work.id, spare.id, (await host.providerOfAsync()).id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.isTrue(requests[1]?.prompt.endsWith(Resources.formatSustainContinued("Working")) ?? false);
    Assert.isTrue(requests[1]?.prompt.includes("one") ?? false);
    Assert.isFalse(requests[1]?.prompt.includes("two") ?? true);
    Assert.isNull(requests[1]?.resumeNativeSessionId ?? null);
    const replies = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.teammateId === bob.id);
    Assert.areEqual(`${MessageStatus.Failed},${MessageStatus.Completed}`, replies.map(t => t.status).join(","));
    Assert.areEqual(replies[0]?.inReplyTo, replies[1]?.inReplyTo);
  }

  @TestMethod
  public async triesEachEntryOnceInAChainAndNamesEveryEntrysResetWhenNoneIsLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, null, null), new TeammateFallback(other.id, null, null)] }));
    const reset = new Date(2 * SustainTurnsTests.hour).toISOString();
    host.adapter.limits.set(work.id, new UsageLimit(reset));
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    host.adapter.limits.set(other.id, new UsageLimit(reset));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual([work.id, spare.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    const now = new Date(host.timer.now());
    const allOut = SustainTurnsTests.allOut("Other", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), reset, now, true),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Spare"), null, now, false),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Other"), reset, now, false)]);
    Assert.areEqual(allOut, (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
    const replies = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.teammateId === bob.id);
    Assert.areEqual(`${MessageStatus.Failed},${MessageStatus.Failed},${MessageStatus.Failed}`, replies.map(t => t.status).join(","));
    Assert.isTrue(host.adapter.requests[2]?.prompt.endsWith(Resources.formatSustainContinued("Working")) ?? false);
  }

  @TestMethod
  public async startsNoContinuationWhenTheTeammatesOwnAccountCanNoLongerReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.afterDetails = async (): Promise<void> => {
      await host.providers.setEnabledAsync(new ProviderEnabledParams(work.id, false));
    };

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual(work.id, host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(1, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.teammateId === bob.id).length);
  }

  @TestMethod
  public async forgetsAChatsSustainAttemptsWithTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    const countAsync = async (): Promise<number> => (await host.context.database.connection.queryAsync(new SqlQuery("SELECT COUNT(*) AS n FROM sustainAttempts", [])))[0]?.readInteger("n") ?? -1;
    const before = await countAsync();

    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.areEqual("1,0", [before, await countAsync()].join(","));
  }

  @TestMethod
  public async namesResetsOnTheFirstOutEntryThatSaysWhenItResetsWhenAnEntryAheadOfItDoesnt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const reset = new Date(2 * SustainTurnsTests.hour).toISOString();
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.limits.set(spare.id, new UsageLimit(reset));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    const now = new Date(host.timer.now());
    Assert.areEqual(SustainTurnsTests.allOut("Spare", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), null, now, false),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Spare"), reset, now, true)]), (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async staysWithoutAMovedBackNoteWhenEveryEntryIsOutAfterAMove(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.adapter.limits.delete(spare.id);

    await SustainTurnsTests.ask(host, conversation, bob, "three");

    Assert.areEqual([work.id, spare.id, spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    const now = new Date(host.timer.now());
    const allOut = SustainTurnsTests.allOut("Spare", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), null, now, true),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Spare"), null, now, false)]);
    Assert.areEqual(Resources.formatSustainMoved("Fake provider", "Spare", "fake-small", "Work"), (await SustainTurnsTests.notesAsync(host, conversation)).join("|"));
    Assert.areEqual(allOut, (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async namesTheAccountTheSessionLeftWhenItMovesOnFromAFallback(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const extra = await host.createProviderAsync("fake", "Extra");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(extra.id, null, null)],
      resetsSoonestFirst: false }));
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.adapter.limits.clear();

    await SustainTurnsTests.ask(host, conversation, bob, "three");

    Assert.areEqual([work.id, spare.id, spare.id, extra.id, extra.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual([Resources.formatSustainMoved("Fake provider", "Spare", "fake-small", "Work"),
      Resources.formatSustainMoved("Fake provider", "Extra", null, "Spare")].join("|"), (await SustainTurnsTests.notesAsync(host, conversation)).join("|"));
  }

  @TestMethod
  public async endsALimitWithoutAResetAtThePlanResetItsFailedTurnReportedWithNoLaterRead(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const reset = new Date(SustainTurnsTests.hour).toISOString();
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.afterDetails = async (): Promise<void> => {
      host.adapter.afterDetails = null;
      await host.adapter.lastListener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.FiveHour, 100, reset)], new Date(host.timer.now()).toISOString());
    };
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);

    await SustainTurnsTests.ask(host, conversation, bob, "two");
    host.timer.jump(SustainTurnsTests.hour);
    await SustainTurnsTests.ask(host, conversation, bob, "three");

    Assert.areEqual([work.id, spare.id, spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(Resources.formatSustainReturned("Fake provider", "Work", "model-b"), (await SustainTurnsTests.notesAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async letsATurnRunningWhenAnotherChatRecordsItsLimitEndThereAndMovesBothChatsNextTurns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation: first, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const second = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const gate = Promise.withResolvers<void>();
    host.adapter.holdTurn = (): Promise<void> => {
      host.adapter.holdTurn = null;
      return gate.promise;
    };
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Bob held", null, null, [], [bob.id]));
    await host.adapter.requested(1);
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob limited", null, null, [], [bob.id]));
    await host.until("the second chat's reply fails", async () => (await SustainTurnsTests.repliesAsync(host, second)).some(t => t.status === MessageStatus.Failed));
    host.adapter.limits.delete(work.id);
    gate.resolve();
    await host.engine.waitForIdle();

    await host.engine.sendAsync(new MessageSendParams(first.id, "@Bob after", null, null, [], [bob.id]));
    await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob after", null, null, [], [bob.id]));
    await host.engine.waitForIdle();

    Assert.areEqual([work.id, work.id, spare.id, spare.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(`${MessageStatus.Completed},${MessageStatus.Completed}`, (await SustainTurnsTests.repliesAsync(host, first)).map(t => t.status).join(","));
    Assert.areEqual(`${MessageStatus.Failed},${MessageStatus.Completed},${MessageStatus.Completed}`, (await SustainTurnsTests.repliesAsync(host, second)).map(t => t.status).join(","));
    Assert.areEqual("1,1", [(await SustainTurnsTests.notesAsync(host, first)).length, (await SustainTurnsTests.notesAsync(host, second)).length].join(","));
  }

  @TestMethod
  public async namesTheTeammatesOwnAccountWhenAChatsFirstTurnMoves(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation: first, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const second = await host.createConversationAsync(await host.openProjectAsync("beta"));
    host.adapter.limits.set(work.id, new UsageLimit(null));
    await SustainTurnsTests.ask(host, first, bob, "one");
    host.adapter.limits.delete(work.id);

    await SustainTurnsTests.ask(host, second, bob, "two");

    Assert.areEqual(spare.id, host.adapter.requests.at(-1)?.provider?.id);
    Assert.isNull(host.adapter.requests.at(-1)?.resumeNativeSessionId ?? null);
    Assert.areEqual(Resources.formatSustainMoved("Fake provider", "Spare", "fake-small", "Work"),
      (await SustainTurnsTests.notesAsync(host, second)).join("|"));
  }

  @TestMethod
  public async continuesOnTheTeammatesOwnAccountWhenItsResetPassesDuringTheMovedTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.delete(work.id);
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    host.adapter.afterDetails = (): void => {
      host.adapter.afterDetails = null;
      host.timer.jump(SustainTurnsTests.hour + 1);
    };

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual([work.id, spare.id, spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual([MessageStatus.Failed, MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Completed].join(","),
      (await SustainTurnsTests.repliesAsync(host, conversation)).map(t => t.status).join(","));
    Assert.areEqual(0, (await SustainTurnsTests.errorsAsync(host, conversation)).filter(t => t.includes(Resources.formatSustainAllOut([]).slice(0, -2))).length);
  }

  @TestMethod
  public async startsNoContinuationWhenTheFailedReplyIsStopped(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const stops = SustainTurnsTests.onFailure(host, bob, t => host.engine.cancelAsync(new MessageIdParams(t.id)));

    await SustainTurnsTests.limitedOnce(host, conversation, work, bob, stops);
  }

  @TestMethod
  public async startsNoContinuationWhenTheChatsRepliesAreCancelled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const stops = SustainTurnsTests.onFailure(host, bob, () => host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id)));

    await SustainTurnsTests.limitedOnce(host, conversation, work, bob, stops);
  }

  @TestMethod
  public async namesWhyEachEntryWasPassedOverWhenNoneIsLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const off = await host.createProviderAsync("fake", "Off");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(off.id, null, null)],
      resetsSoonestFirst: false }));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    host.adapter.limits.set(spare.id, new UsageLimit(null));
    host.adapter.afterDetails = (): void => {
      if (host.adapter.requests.length === 2)
        host.timer.jump(SustainTurnsTests.hour + 1);
    };

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual([work.id, spare.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(SustainTurnsTests.allOut("Spare", [Resources.formatSustainEntryTried(SustainTurnsTests.stopped("Work")),
      Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Spare"), null, new Date(host.timer.now()), true),
      Resources.formatSustainEntryUnavailable(SustainTurnsTests.stopped("Off"))]), (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async handsOverTheFirstMessageAndTheNewestTurnsThatFitTheTargetsWindowAndNamesTheTurnsLeftOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const pad = "p".repeat(1_500);
    host.adapter.usage = new ReplyUsage(10, 10, null, new ContextUsage(100, 20_000, null));
    for (const text of [`first ${pad}`, `second ${pad}`, `third ${pad}`])
      await SustainTurnsTests.ask(host, conversation, bob, text);
    host.adapter.usage = null;
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await SustainTurnsTests.ask(host, conversation, bob, "four");
    host.adapter.limits.delete(work.id);
    host.timer.jump(SustainTurnsTests.hour + 1);

    await SustainTurnsTests.ask(host, conversation, bob, "five");

    const request = host.adapter.requests.at(-1);
    const messages = await host.messages.listAsync(new MessageListParams(conversation.id, null));
    const second = messages.find(t => t.details.some(d => d.text.includes("second")));
    const prompt = request?.prompt ?? String.empty;
    Assert.areEqual(`${work.id}|null`, `${request?.provider?.id}|${request?.resumeNativeSessionId ?? null}`);
    Assert.isTrue(prompt.includes(`first ${pad}`) && prompt.includes(`third ${pad}`) && prompt.includes("five"));
    Assert.isFalse(prompt.includes("second"));
    Assert.isTrue(prompt.includes(Resources.formatHandoverLeftOut([Resources.formatHandoverRange((second?.sequence ?? 0) - 1, second?.sequence ?? 0)], conversation.id)));
  }

  @TestMethod
  public async writesEachToolCallOnOneLineAndCutsALongResultInTheHistoryButNotInWhatTheFailedReplyWrote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.detailTexts = [];
    await SustainTurnsTests.ask(host, conversation, bob, "zero");
    host.adapter.detailTexts = ["Working"];
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, `Ran listing${Resources.lineSeparator}${"o".repeat(3_000)}`, { command: "ls", status: "completed" }, "run-1"),
      new TurnDetail(DetailKind.Command, "Ran pwd", { command: "pwd", status: "completed" }, "run-2"),
      new TurnDetail(DetailKind.Note, "r".repeat(2_500), { toolUseId: "tool-1" }, "result-1"), new TurnDetail(DetailKind.Note, "a passing note", null, "note-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    const first = (await SustainTurnsTests.repliesAsync(host, conversation))[1];
    const prompt = host.adapter.requests.at(-1)?.prompt ?? String.empty;
    const sequence = first?.sequence ?? 0;
    Assert.isTrue(prompt.includes("zero"));
    Assert.isTrue(prompt.includes(Resources.formatHandoverTool("Ran listing")) && prompt.includes(`${Resources.formatHandoverTool("Ran pwd")}${Resources.lineSeparator}`));
    Assert.isTrue(prompt.includes(Resources.formatHandoverCut(1_000, sequence)) && prompt.includes(Resources.formatHandoverCut(500, sequence)));
    Assert.isTrue(prompt.includes("o".repeat(3_000)) && prompt.includes("r".repeat(2_500)));
    Assert.isFalse(prompt.includes("a passing note"));
  }

  @TestMethod
  public async skipsAnEntryWhoseWindowHasNoRoomForTheHandoverAndCountsItTried(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(other.id, null, null)] }));
    await SustainTurnsTests.fillWindow(host, conversation, spare);
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual([spare.id, work.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(`${MessageStatus.Failed},${MessageStatus.Completed}`, (await SustainTurnsTests.repliesAsync(host, conversation)).map(t => t.status).join(","));
  }

  @TestMethod
  public async skipsAnEntryWithNoRoomForTheHandoverWhenATurnMovesAtItsStart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(other.id, null, null)] }));
    await SustainTurnsTests.fillWindow(host, conversation, spare);
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await SustainTurnsTests.ask(host, conversation, bob, "one");

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    const requests = host.adapter.requests;
    Assert.areEqual([spare.id, work.id, other.id, other.id].join(","), requests.map(t => t.provider?.id).join(","));
    Assert.isNotNull(requests.at(-1)?.resumeNativeSessionId ?? null);
  }

  @TestMethod
  public async namesAnEntrySkippedForWantOfRoomWhenNoEntryIsLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    await SustainTurnsTests.fillWindow(host, conversation, spare);
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual([spare.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(SustainTurnsTests.allOut("Work", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), null, new Date(host.timer.now()), true),
      Resources.formatSustainEntryNoRoom(SustainTurnsTests.stopped("Spare"))]), (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async namesAnEntrySkippedAtATurnsStartAsHavingNoRoomWhenTheTurnThenStopsAtALimit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(spare.id, "fake-small", "low"), new TeammateFallback(other.id, null, null)] }));
    await SustainTurnsTests.fillWindow(host, conversation, spare);
    const reset = new Date(SustainTurnsTests.hour).toISOString();
    host.adapter.limits.set(work.id, new UsageLimit(reset));
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.limits.set(other.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    const now = new Date(host.timer.now());
    Assert.areEqual([spare.id, work.id, other.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual(SustainTurnsTests.allOut("Other", [Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Work"), reset, now, true),
      Resources.formatSustainEntryNoRoom(SustainTurnsTests.stopped("Spare")), Resources.formatSustainEntryReset(SustainTurnsTests.stopped("Other"), null, now, false)]),
    (await SustainTurnsTests.errorsAsync(host, conversation)).at(-1));
  }

  @TestMethod
  public async sizesTheHandoverByTheWindowAnotherAccountOfTheSameKindReportedForTheModel(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const extra = await host.createProviderAsync("fake", "Extra");
    const other = await host.createProviderAsync("fake", "Other");
    await host.teammates.updateAsync(TeammateUpdateParams.of(bob.id, { fallbacks: [new TeammateFallback(extra.id, "fake-small", "low"), new TeammateFallback(other.id, null, null)] }));
    await SustainTurnsTests.fillWindow(host, conversation, spare);
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");

    Assert.areEqual([spare.id, work.id, other.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
  }

  @TestMethod
  public async handsOverTheLeftSessionsCompactionSummaryInPlaceOfTheChatItSummarizes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const reads: string[] = [];
    host.adapter.readCompaction = (provider, session): Promise<string | null> => {
      reads.push(`${provider?.id}|${session}`);
      return Promise.resolve("The work so far.");
    };
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    await SustainTurnsTests.ask(host, conversation, bob, "summarized-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    await SustainTurnsTests.ask(host, conversation, bob, "kept-ask");
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    const request = host.adapter.requests.at(-1);
    const prompt = request?.prompt ?? String.empty;
    const chat = await host.messages.listAsync(new MessageListParams(conversation.id, null));
    const first = chat.findIndex(t => t.details.some(d => d.text.includes("first-ask")));
    const compacting = chat.find(t => t.details.some(d => d.text.includes("compacting-ask")));
    const range = Resources.formatHandoverRange(chat[first + 1]?.sequence ?? 0, compacting?.sequence ?? 0);
    Assert.areEqual(spare.id, request?.provider?.id);
    Assert.isTrue(reads.length > 0 && reads.every(t => t === `${work.id}|session-1`));
    Assert.areEqual(0, host.adapter.requests.filter(t => t.isolated).length);
    Assert.isTrue(prompt.includes(Resources.formatHandoverSummary("The work so far.")));
    Assert.isTrue(prompt.includes("first-ask") && prompt.includes("kept-ask") && prompt.includes("limit-ask"));
    Assert.isFalse(prompt.includes("summarized-ask") || prompt.includes("compacting-ask"));
    Assert.isTrue(prompt.includes(Resources.formatHandoverLeftOut([range], conversation.id)));
    Assert.isTrue(prompt.indexOf("first-ask") < prompt.indexOf("The work so far.") && prompt.indexOf("The work so far.") < prompt.indexOf("kept-ask"));
    const note = SustainTurnsTests.objectOf((await SustainTurnsTests.sustainDetailsAsync(host, conversation)).at(-1)?.payload ?? null);
    const carried = note[Resources.sustainCarriedField];
    Assert.isTrue(Array.isArray(carried)
      && carried.includes(Resources.formatHandoverCarriedSummary("Fake provider", true, chat[first + 1]?.sequence ?? 0, compacting?.sequence ?? 0)));
    Assert.isFalse(Array.isArray(carried) && carried.some(t => String(t).startsWith("Left out")));
    Assert.isTrue(Object.isUndefined(note[Resources.sustainReadsField]));
  }

  @TestMethod
  public async handsOverTheChatFromItsBeginningAndLogsWhyWhenNeitherTheSessionsSummaryNorTeamRunsOwnCanBeHad(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const failure = new Error("unreadable");
    const refused = new TypeError("refused");
    host.adapter.readCompaction = (): Promise<string | null> => Promise.reject(failure);
    host.adapter.holdTurn = (request): Promise<void> => request.isolated ? Promise.reject(refused) : Promise.resolve();
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    const prompt = host.adapter.requests.at(-1)?.prompt ?? String.empty;
    Assert.isTrue(prompt.includes("first-ask") && prompt.includes("compacting-ask"));
    Assert.isFalse(prompt.includes(Resources.formatHandoverSummary(String.empty)));
    Assert.isTrue(host.log.lines.includes(Resources.formatCompactionUnread(work.id, Resources.formatFailureKind(failure))));
    Assert.isTrue(host.log.lines.includes(Resources.formatOwnSummaryFailed(spare.id, Resources.formatFailureKind(refused))));
  }

  @TestMethod
  public async handsOverTheWholeChatWhenTeamRunsOwnSummaryRunsOutOfTime(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    let held = (): void => undefined;
    const holding = new Promise<void>(resolve => {
      held = resolve;
    });
    host.adapter.holdTurn = (request, signal): Promise<void> => {
      if (!request.isolated)
        return Promise.resolve();
      held();
      return new Promise(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    };
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(null));

    const asking = SustainTurnsTests.ask(host, conversation, bob, "limit-ask");
    await holding;
    const waiting = (await SustainTurnsTests.repliesAsync(host, conversation)).at(-1)?.details.map(t => t.kind).join(",");
    host.timer.advance(Resources.ownSummaryTimeout - 1);
    const early = host.adapter.requests.length;
    host.timer.advance(1);
    await asking;

    const prompt = host.adapter.requests.at(-1)?.prompt ?? String.empty;
    const asked = host.adapter.requests.filter(t => t.isolated);
    Assert.areEqual(`${early + 1}|1|${spare.id}`, `${host.adapter.requests.length}|${asked.length}|${asked[0]?.provider?.id}`);
    Assert.isTrue(prompt.includes("first-ask") && prompt.includes("compacting-ask"));
    Assert.isTrue(host.log.lines.includes(Resources.formatOwnSummaryFailed(spare.id, Resources.formatFailureKind(new OwnSummaryUnansweredException(TurnOutcome.Failed)))));
    const notes = (await SustainTurnsTests.repliesAsync(host, conversation)).at(-1)?.details.filter(t => t.kind === DetailKind.Note) ?? [];
    Assert.areEqual(`${DetailKind.Note}|1`, `${waiting}|${notes.length}`);
    Assert.isTrue(JSON.stringify(notes[0]?.payload).includes(Resources.sustainHandoverField));
  }

  @TestMethod
  public async startsNoContinuationWhenTheChatIsStoppedWhileItsHandoverIsBuilt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const reading = Promise.withResolvers<void>();
    const summary = Promise.withResolvers<string | null>();
    host.adapter.readCompaction = (): Promise<string | null> => {
      reading.resolve();
      return summary.promise;
    };
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    host.adapter.limits.set(work.id, new UsageLimit(null));

    const asking = SustainTurnsTests.ask(host, conversation, bob, "limit-ask");
    await reading.promise;
    const stopping = host.engine.cancelConversationAsync(new ConversationIdParams(conversation.id));
    summary.resolve("The work so far.");
    await asking;
    await stopping;

    Assert.areEqual([work.id, work.id].join(","), host.adapter.requests.map(t => t.provider?.id).join(","));
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Failed].join(","), (await SustainTurnsTests.repliesAsync(host, conversation)).map(t => t.status).join(","));
  }

  @TestMethod
  public async writesTeamRunsOwnSummaryOnTheEntryWhenTheSessionHasNoneAndReusesItForTheMoveBack(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(null);
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    await SustainTurnsTests.ask(host, conversation, bob, "summarized-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    await SustainTurnsTests.ask(host, conversation, bob, "kept-ask");
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    host.adapter.detailTexts = ["The work so far."];
    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");
    host.adapter.limits.delete(work.id);
    host.timer.jump(SustainTurnsTests.hour + 1);

    await SustainTurnsTests.ask(host, conversation, bob, "back-ask");

    const requests = host.adapter.requests;
    const asked = requests.filter(t => t.isolated);
    const continued = requests[requests.findIndex(t => t.isolated) + 1]?.prompt ?? String.empty;
    const back = requests.at(-1);
    const summary = Resources.formatHandoverSummary("The work so far.");
    const countAsync = async (): Promise<number> => (await host.context.database.connection.queryAsync(new SqlQuery("SELECT COUNT(*) AS n FROM handoverSummaries", [])))[0]?.readInteger("n") ?? -1;
    Assert.areEqual(`1|${spare.id}|${work.id}`, `${asked.length}|${asked[0]?.provider?.id}|${back?.provider?.id}`);
    Assert.isTrue((asked[0]?.prompt ?? String.empty).startsWith(Resources.formatOwnSummaryPrompt(String.empty)));
    Assert.isTrue(["first-ask", "summarized-ask", "compacting-ask"].every(t => asked[0]?.prompt.includes(t)));
    Assert.isFalse((asked[0]?.prompt ?? String.empty).includes("kept-ask"));
    Assert.isTrue(continued.includes(summary) && continued.includes("kept-ask") && !continued.includes("summarized-ask"));
    Assert.isTrue((back?.prompt ?? String.empty).includes(summary));
    Assert.areEqual("true,true", (await SustainTurnsTests.sustainDetailsAsync(host, conversation)).slice(-2)
      .map(t => SustainTurnsTests.objectOf(t.payload)[Resources.sustainCarriedField])
      .map(t => Array.isArray(t) && t.some(line => String(line).startsWith("Fake provider's handover summary, covering messages "))).join(","));
    Assert.areEqual(1, await countAsync());
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));
    Assert.areEqual(0, await countAsync());
  }

  @TestMethod
  public async namesAKeptSummaryByTheKindThatWroteItAndLeavesItsMessagesOutWhenThatKindIsUnknown(): Promise<void> {
    const backs: string[] = [];
    for (const kind of [undefined, null, "gone"]) {
      await using host = await CoreHost.createAsync();
      const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
      host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(null);
      await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
      host.adapter.runsIsolated();
      await SustainTurnsTests.ask(host, conversation, bob, "summarized-ask");
      host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
      await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
      host.adapter.extraDetails = [];
      await SustainTurnsTests.ask(host, conversation, bob, "kept-ask");
      host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
      host.adapter.detailTexts = ["The work so far."];
      await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");
      host.adapter.limits.delete(work.id);
      host.timer.jump(SustainTurnsTests.hour + 1);
      if (!Object.isUndefined(kind))
        await host.context.database.connection.executeAsync(new SqlQuery("UPDATE handoverSummaries SET kind = ?", [kind]));

      await SustainTurnsTests.ask(host, conversation, bob, "back-ask");

      const note = SustainTurnsTests.objectOf((await SustainTurnsTests.sustainDetailsAsync(host, conversation)).at(-1)?.payload ?? null);
      const carried = note[Resources.sustainCarriedField];
      const lines = (Array.isArray(carried) ? carried : []).map(t => String(t));
      backs.push([lines.some(t => t.startsWith("Fake provider's handover summary, covering messages ")), lines.some(t => t.startsWith("Left out: messages ")),
        Object.isString(note[Resources.sustainReadsField])].join(","));
    }

    Assert.areEqual(["true,false,false", "false,true,true", "false,true,true"].join("/"), backs.join("/"));
  }

  @TestMethod
  public async takesTheSummaryOfACompactionInTheTurnThatHitsTheLimit(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve("The work so far.");
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    await SustainTurnsTests.ask(host, conversation, bob, "summarized-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    const prompt = host.adapter.requests.at(-1)?.prompt ?? String.empty;
    Assert.isTrue(prompt.includes(Resources.formatHandoverSummary("The work so far.")) && prompt.includes("first-ask") && prompt.includes("limit-ask"));
    Assert.isFalse(prompt.includes("summarized-ask"));
  }

  @TestMethod
  public async readsNoSessionSummaryForAMoveFromAChatWithoutACompaction(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    let reads = 0;
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(String(++reads));
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    Assert.areEqual(`${spare.id}|0|0`, `${host.adapter.requests.at(-1)?.provider?.id}|${reads}|${host.adapter.requests.filter(t => t.isolated).length}`);
  }

  @TestMethod
  public async readsNoCompactionWhenTheSessionLeftIsOnAnAccountSinceRemoved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const reads: string[] = [];
    host.adapter.readCompaction = (provider): Promise<string | null> => {
      reads.push(provider?.id ?? String.empty);
      return Promise.resolve("The work so far.");
    };
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.extraDetails = [];
    host.adapter.limits.delete(work.id);
    reads.length = 0;
    await host.providers.deleteAsync(new ProviderIdParams(spare.id));
    host.timer.jump(SustainTurnsTests.hour + 1);

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    Assert.areEqual(`${work.id}|0`, `${host.adapter.requests.at(-1)?.provider?.id}|${reads.length}`);
  }

  @TestMethod
  public async readsNoCompactionWhenTheTeammateHoldsNoSessionAnyMore(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    let reads = 0;
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(String(++reads));
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "one");
    host.adapter.extraDetails = [];
    host.adapter.limits.delete(work.id);
    reads = 0;
    await host.conversations.setMemberSessionAsync(new ConversationMemberParams(conversation.id, bob.id), null, false);

    await SustainTurnsTests.ask(host, conversation, bob, "two");

    const request = host.adapter.requests.at(-1);
    Assert.areEqual(`${spare.id}|0`, `${request?.provider?.id}|${reads}`);
    Assert.isTrue((request?.prompt ?? String.empty).includes("one"));
  }

  @TestMethod
  public async writesTeamRunsOwnSummaryWhenTheLeftProviderHasNoCompactionReader(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    await SustainTurnsTests.ask(host, conversation, bob, "summarized-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(null));
    host.adapter.detailTexts = ["The work so far."];

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    const request = host.adapter.requests.at(-1);
    const prompt = request?.prompt ?? String.empty;
    const asked = host.adapter.requests.filter(t => t.isolated);
    Assert.areEqual(`1|${spare.id}|${spare.id}`, `${asked.length}|${asked[0]?.provider?.id}|${request?.provider?.id}`);
    Assert.isTrue(prompt.includes(Resources.formatHandoverSummary("The work so far.")) && prompt.includes("first-ask") && prompt.includes("limit-ask"));
    Assert.isFalse(prompt.includes("summarized-ask"));
  }

  @TestMethod
  public async handsOverTheWholeChatWithoutASummaryOrALogWhereTheTargetRunsNoIsolatedTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(null);
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");

    const request = host.adapter.requests.at(-1);
    const prompt = request?.prompt ?? String.empty;
    Assert.areEqual(`${spare.id}|0`, `${request?.provider?.id}|${host.adapter.requests.filter(t => t.isolated).length}`);
    Assert.isTrue(prompt.includes("first-ask") && prompt.includes("compacting-ask") && prompt.includes("limit-ask"));
    const [failed = String.empty] = Resources.formatOwnSummaryFailed(spare.id, String.empty).split("()");
    Assert.isFalse(host.log.lines.some(t => t.startsWith(failed)));
  }

  @TestMethod
  public async asksNoSummaryAgainFromAPointWhoseSummaryFailed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const refused = new TypeError("refused");
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(null);
    host.adapter.holdTurn = (request): Promise<void> => request.isolated ? Promise.reject(refused) : Promise.resolve();
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.runsIsolated();
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(new Date(SustainTurnsTests.hour).toISOString()));
    await SustainTurnsTests.ask(host, conversation, bob, "limit-ask");
    host.adapter.limits.delete(work.id);
    host.timer.jump(SustainTurnsTests.hour + 1);

    await SustainTurnsTests.ask(host, conversation, bob, "back-ask");

    const back = host.adapter.requests.at(-1);
    const failed = Resources.formatOwnSummaryFailed(spare.id, Resources.formatFailureKind(refused));
    Assert.areEqual(`${work.id}|1|1`, `${back?.provider?.id}|${host.adapter.requests.filter(t => t.isolated).length}|${host.log.lines.filter(t => t === failed).length}`);
    Assert.isTrue((back?.prompt ?? String.empty).includes("compacting-ask"));
  }

  @TestMethod
  public async postsNoMoveNoteBeforeTheSummaryOfAReturnWhileEveryAccountIsOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { conversation, work, spare, bob } = await SustainTurnsTests.arrangeAsync(host, true);
    const until = new Date(SustainTurnsTests.hour).toISOString();
    host.adapter.readCompaction = (): Promise<string | null> => Promise.resolve(null);
    await SustainTurnsTests.ask(host, conversation, bob, "first-ask");
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Context compacted", { [Resources.compactionField]: true }, "compact-1")];
    await SustainTurnsTests.ask(host, conversation, bob, "compacting-ask");
    host.adapter.extraDetails = [];
    host.adapter.limits.set(work.id, new UsageLimit(until));
    await SustainTurnsTests.ask(host, conversation, bob, "moved-ask");
    host.adapter.limits.set(spare.id, new UsageLimit(until));
    await SustainTurnsTests.ask(host, conversation, bob, "spare-ask");
    host.adapter.limits.clear();

    await SustainTurnsTests.ask(host, conversation, bob, "back-ask");

    const back = host.adapter.requests.at(-1);
    const reply = (await SustainTurnsTests.repliesAsync(host, conversation)).at(-1);
    Assert.areEqual(`${work.id}|0`, `${back?.provider?.id}|${reply?.details.filter(t => t.kind === DetailKind.Note).length}`);
    Assert.isTrue((back?.prompt ?? String.empty).includes("first-ask"));
  }

  private static async fillWindow(host: CoreHost, conversation: Conversation, provider: Provider): Promise<void> {
    host.adapter.usage = new ReplyUsage(10, 10, null, new ContextUsage(100, Resources.handoverProviderRoomTokens, null));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "hi", new RequestedSettings("fake", "fake-small", null), provider.id));
    await host.engine.waitForIdle();
    host.adapter.usage = null;
  }

  private static onFailure(host: CoreHost, teammate: Teammate, stop: (reply: Message) => Promise<unknown>): Promise<unknown>[] {
    const stops: Promise<unknown>[] = [];
    host.events.subscribe({
      onEvent: event => {
        if (event.name !== EventName.MessageUpdated || stops.length > 0)
          return;
        const message = Message.fromJson(event.payload);
        if (message.teammateId === teammate.id && message.status === MessageStatus.Failed)
          stops.push(stop(message));
      }
    });
    return stops;
  }

  private static async limitedOnce(host: CoreHost, conversation: Conversation, work: Provider, bob: Teammate, stops: readonly Promise<unknown>[]): Promise<void> {
    host.adapter.limits.set(work.id, new UsageLimit(null));

    await SustainTurnsTests.ask(host, conversation, bob, "one");
    await Promise.all(stops);

    Assert.areEqual(`1|${work.id}|${MessageStatus.Failed}|0`, [stops.length, host.adapter.requests.map(t => t.provider?.id).join(","),
      (await SustainTurnsTests.repliesAsync(host, conversation)).map(t => t.status).join(","), (await SustainTurnsTests.notesAsync(host, conversation)).length].join("|"));
  }

  private static async repliesAsync(host: CoreHost, conversation: Conversation): Promise<readonly Message[]> {
    return (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => !Object.isNull(t.teammateId));
  }

  private static async arrangeAsync(host: CoreHost, sustain: boolean): Promise<{ conversation: Conversation; work: Provider; spare: Provider; bob: Teammate }> {
    const conversation = await host.createConversationAsync();
    const work = await host.createProviderAsync("fake", "Work");
    const spare = await host.createProviderAsync("fake", "Spare");
    const created = await host.teammates.createAsync(new TeammateCreateParams("Bob", "Implement carefully", work.id, Harness.Provider, "model-b", "low"));
    const bob = await host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { sustain, fallbacks: [new TeammateFallback(spare.id, "fake-small", "low")] }));
    return { conversation, work, spare, bob };
  }

  private static async ask(host: CoreHost, conversation: Conversation, teammate: Teammate, text: string): Promise<void> {
    await host.engine.sendAsync(new MessageSendParams(conversation.id, `@${teammate.name} ${text}`, null, null, [], [teammate.id]));
    await host.engine.waitForIdle();
  }

  private static async errorsAsync(host: CoreHost, conversation: Conversation): Promise<readonly string[]> {
    return (await SustainTurnsTests.repliesAsync(host, conversation)).flatMap(t => t.details.filter(d => d.kind === DetailKind.Error).map(d => d.text));
  }

  private static stopped(label: string): string {
    return Resources.formatStoppedAccount("Fake provider", label);
  }

  private static allOut(label: string, entries: readonly string[]): string {
    return Resources.formatUsageLimitStopped(SustainTurnsTests.stopped(label), Resources.formatSustainAllOut(entries));
  }

  private static async notesAsync(host: CoreHost, conversation: Conversation): Promise<readonly string[]> {
    return (await SustainTurnsTests.sustainDetailsAsync(host, conversation)).map(t => t.text);
  }

  private static async sustainDetailsAsync(host: CoreHost, conversation: Conversation): Promise<readonly MessageDetail[]> {
    return (await host.messages.listAsync(new MessageListParams(conversation.id, null)))
      .flatMap(t => t.details.filter(d => SustainTurnsTests.sourceOf(d.payload) === Resources.sustainSource));
  }

  private static objectOf(payload: JsonValue): JsonObject {
    return SustainTurnsTests.isObject(payload) ? payload : {};
  }

  private static sourceOf(payload: JsonValue): JsonValue | undefined {
    return SustainTurnsTests.isObject(payload) ? payload["source"] : undefined;
  }

  private static isObject(payload: JsonValue): payload is JsonObject {
    return typeof payload === "object" && payload !== null && !Array.isArray(payload);
  }
}
