/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppLook, ComputerUseGrantsService, ComputerUseGrantTimings, RememberedAppGrant, Resources } from "@noldova/teamrun.core";
import { ComputerUseGrantIdParams, ErrorCode, Harness, TeammateCreateParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ComputerUseGrantsServiceTests {
  @TestMethod
  public async listsEachGrantNewestFirstWithItsChatTeammateAndAppOrTheScreen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Release notes");
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Reviewer", null, (await host.createProviderAsync()).id, Harness.Provider, null, null));
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope(chat.id, null), new Date("2026-10-29T10:00:00.000Z")),
      new RememberedAppGrant("g2", "com.example.paint", Resources.formatToolScope(chat.id, reviewer.id), new Date("2026-10-29T11:00:00.000Z")),
      new RememberedAppGrant("g3", "com.example.mail", Resources.formatToolScope("gone", "left"), new Date("2026-10-29T09:00:00.000Z")),
      new RememberedAppGrant("g4", null, Resources.formatToolScope(chat.id, null), new Date("2026-10-29T08:00:00.000Z"))
    ];

    const listed = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([
      { id: "g2", chatId: chat.id, chatTitle: "Release notes", teammateName: "Reviewer", app: "com.example.paint", appName: null, appIcon: null,
        grantedAt: "2026-10-29T11:00:00.000Z" },
      { id: "g1", chatId: chat.id, chatTitle: "Release notes", teammateName: null, app: "com.example.notes", appName: null, appIcon: null,
        grantedAt: "2026-10-29T10:00:00.000Z" },
      { id: "g3", chatId: "gone", chatTitle: null, teammateName: null, app: "com.example.mail", appName: null, appIcon: null, grantedAt: "2026-10-29T09:00:00.000Z" },
      { id: "g4", chatId: chat.id, chatTitle: "Release notes", teammateName: null, app: null, appName: null, appIcon: null, grantedAt: "2026-10-29T08:00:00.000Z" }
    ]), JSON.stringify(listed.map(t => t.toJson())));
  }

  @TestMethod
  public async namesEachAppOncePerListingAndKeepsTheIdentityWhereItCantBeDescribed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const controller = new AbortController();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", "iVBORw0KGgo=")], ["com.example.paint", new AppLook("Paint", null)]]);
    host.appDescriptions.failing.add("com.example.mail");
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date("2026-10-29T10:00:00.000Z")),
      new RememberedAppGrant("g2", "com.example.notes", Resources.formatToolScope("c2", null), new Date("2026-10-29T09:00:00.000Z")),
      new RememberedAppGrant("g3", "com.example.paint", Resources.formatToolScope("c1", null), new Date("2026-10-29T08:00:00.000Z")),
      new RememberedAppGrant("g4", "com.example.mail", Resources.formatToolScope("c1", null), new Date("2026-10-29T07:00:00.000Z")),
      new RememberedAppGrant("g5", "com.example.maps", Resources.formatToolScope("c1", null), new Date("2026-10-29T06:00:00.000Z")),
      new RememberedAppGrant("g6", null, Resources.formatToolScope("c1", null), new Date("2026-10-29T05:00:00.000Z"))
    ];

    const listed = await host.computerUseGrants.listAsync(controller.signal);

    Assert.areEqual(JSON.stringify([
      ["g1", "Notes", "iVBORw0KGgo="], ["g2", "Notes", "iVBORw0KGgo="], ["g3", "Paint", null], ["g4", null, null], ["g5", null, null], ["g6", null, null]
    ]), JSON.stringify(listed.map(t => [t.id, t.appName, t.appIcon])));
    Assert.areEqual("com.example.notes,com.example.paint,com.example.mail,com.example.maps", host.appDescriptions.described.join(","));
    Assert.areEqual(1, new Set(host.appDescriptions.signals).size);
    Assert.isFalse(host.appDescriptions.signals[0]?.aborted ?? true);
    controller.abort();
    Assert.isTrue(host.appDescriptions.signals[0]?.aborted ?? false);
  }

  @TestMethod
  public async keepsTheIdentityOfEachAppNotDescribedByTheListingsDeadlineAndAbortsTheirDescriptions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    host.appDescriptions.unanswered.add("com.example.mail");
    host.appDescriptions.unanswered.add("com.example.paint");
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date("2026-10-29T10:00:00.000Z")),
      new RememberedAppGrant("g2", "com.example.mail", Resources.formatToolScope("c1", null), new Date("2026-10-29T09:00:00.000Z")),
      new RememberedAppGrant("g3", "com.example.paint", Resources.formatToolScope("c1", null), new Date("2026-10-29T08:00:00.000Z"))
    ];

    const listing = host.computerUseGrants.listAsync();
    await host.appDescriptions.answeredAsync();
    host.timer.advance(1_000);
    const listed = await listing;

    Assert.areEqual(JSON.stringify([["com.example.notes", "Notes"], ["com.example.mail", null], ["com.example.paint", null]]),
      JSON.stringify(listed.map(t => [t.app, t.appName])));
    Assert.isTrue(host.appDescriptions.signals.every(t => t?.aborted ?? false));
  }

  @TestMethod
  public async namesOnALaterListingTheAppsAnEarlierOneMissedByItsDeadlineAndAsksOnlyForThose(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)], ["com.example.mail", new AppLook("Mail", null)],
      ["com.example.paint", new AppLook("Paint", null)]]);
    host.appDescriptions.unanswered.add("com.example.mail");
    host.appDescriptions.unanswered.add("com.example.paint");
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date("2026-10-29T10:00:00.000Z")),
      new RememberedAppGrant("g2", "com.example.mail", Resources.formatToolScope("c1", null), new Date("2026-10-29T09:00:00.000Z")),
      new RememberedAppGrant("g3", "com.example.paint", Resources.formatToolScope("c1", null), new Date("2026-10-29T08:00:00.000Z"))
    ];

    const listing = host.computerUseGrants.listAsync();
    await host.appDescriptions.answeredAsync();
    host.timer.advance(1_000);
    const first = await listing;
    host.appDescriptions.unanswered.clear();
    const second = await host.computerUseGrants.listAsync();
    const third = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([["Notes", null, null], ["Notes", "Mail", "Paint"], ["Notes", "Mail", "Paint"]]),
      JSON.stringify([first, second, third].map(t => t.map(grant => grant.appName))));
    Assert.areEqual("com.example.notes,com.example.mail,com.example.paint,com.example.mail,com.example.paint", host.appDescriptions.described.join(","));
  }

  @TestMethod
  public async describesAnAppAgainOnceItsDescriptionOutlivesItsLifetimeAndKeepsTheOldOneWhileANewOneIsMissing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];

    const first = await host.computerUseGrants.listAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes Pro", "iVBORw0KGgo=")]]);
    host.timer.advance(59_999);
    const kept = await host.computerUseGrants.listAsync();
    host.timer.advance(1);
    const changed = await host.computerUseGrants.listAsync();
    host.timer.advance(60_000);
    host.appDescriptions.unanswered.add("com.example.notes");
    const listing = host.computerUseGrants.listAsync();
    host.timer.advance(1_000);
    const late = await listing;
    host.appDescriptions.unanswered.clear();
    host.appDescriptions.failing.add("com.example.notes");
    const failed = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([["Notes", null], ["Notes", null], ["Notes Pro", "iVBORw0KGgo="], ["Notes Pro", "iVBORw0KGgo="], ["Notes Pro", "iVBORw0KGgo="]]),
      JSON.stringify([first, kept, changed, late, failed].map(t => [t[0]?.appName, t[0]?.appIcon])));
    Assert.areEqual(4, host.appDescriptions.described.length);
  }

  @TestMethod
  public async keepsNoDescriptionThatAnswersAfterTheListingsDeadlineAndAsksForItAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.mail", new AppLook("Mail", null)]]);
    host.appDescriptions.held.add("com.example.mail");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.mail", Resources.formatToolScope("c1", null), new Date())];

    const listing = host.computerUseGrants.listAsync();
    host.timer.advance(1_000);
    const first = await listing;
    host.appDescriptions.held.clear();
    host.appDescriptions.release();
    const second = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([null, "Mail"]), JSON.stringify([first[0]?.appName, second[0]?.appName]));
    Assert.areEqual("com.example.mail,com.example.mail", host.appDescriptions.described.join(","));
  }

  @TestMethod
  public async sharesAnAppsDescriptionInFlightBetweenTwoListingsAtOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.mail", new AppLook("Mail", null)]]);
    host.appDescriptions.held.add("com.example.mail");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.mail", Resources.formatToolScope("c1", null), new Date())];

    const first = host.computerUseGrants.listAsync();
    const second = host.computerUseGrants.listAsync();
    host.appDescriptions.release();
    const listed = await Promise.all([first, second]);

    Assert.areEqual(JSON.stringify(["Mail", "Mail"]), JSON.stringify(listed.map(t => t[0]?.appName)));
    Assert.areEqual("com.example.mail", host.appDescriptions.described.join(","));
  }

  @TestMethod
  public async describesAnAppAgainWhenItIsGrantedOnceMoreAfterARevokeOrAForgottenChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];

    await host.computerUseGrants.listAsync();
    host.computerUseGrants.revoke(new ComputerUseGrantIdParams("g1"));
    host.rememberedGrants.grants = [new RememberedAppGrant("g2", "com.example.notes", Resources.formatToolScope("c2", null), new Date())];
    await host.computerUseGrants.listAsync();
    host.computerUseGrants.forget(["c2"]);
    host.rememberedGrants.grants = [new RememberedAppGrant("g3", "com.example.notes", Resources.formatToolScope("c3", null), new Date())];
    const listed = await host.computerUseGrants.listAsync();

    Assert.areEqual("Notes", listed[0]?.appName);
    Assert.areEqual("com.example.notes,com.example.notes,com.example.notes", host.appDescriptions.described.join(","));
  }

  @TestMethod
  public async keepsNoAnswerThatAnAppHasNoDescriptionAndNamesTheAppOnceItHasOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];

    const before = await host.computerUseGrants.listAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    const after = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([null, "Notes"]), JSON.stringify([before[0]?.appName, after[0]?.appName]));
  }

  @TestMethod
  public async keepsNoDescriptionThatAnswersAfterItsAppIsRevokedAndDescribesItAgainOnceGrantedOnceMore(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    host.appDescriptions.held.add("com.example.notes");
    const grant = new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date());
    host.rememberedGrants.grants = [grant];

    const listing = host.computerUseGrants.listAsync();
    host.computerUseGrants.revoke(new ComputerUseGrantIdParams("g1"));
    host.appDescriptions.release();
    await listing;
    host.rememberedGrants.grants = [grant];
    const listed = await host.computerUseGrants.listAsync();

    Assert.areEqual("Notes", listed[0]?.appName);
    Assert.areEqual("com.example.notes,com.example.notes", host.appDescriptions.described.join(","));
  }

  @TestMethod
  public async leavesNoDeadlineWaitOnceAListingReturnsInTimeOrAsItsCallEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const controller = new AbortController();
    host.appDescriptions.looks = new Map([["com.example.notes", new AppLook("Notes", null)]]);
    host.appDescriptions.unanswered.add("com.example.mail");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];

    const inTime = host.computerUseGrants.listAsync();
    const waiting = host.timer.pending;
    const listed = await inTime;
    const afterInTime = host.timer.pending;
    host.rememberedGrants.grants = [new RememberedAppGrant("g2", "com.example.mail", Resources.formatToolScope("c1", null), new Date())];
    const ended = host.computerUseGrants.listAsync(controller.signal);
    controller.abort();
    await Assert.throwsAsync(() => ended, Error);

    Assert.areEqual("Notes", listed[0]?.appName);
    Assert.areEqual("1,0,0", [waiting, afterInTime, host.timer.pending].join(","));
  }

  @TestMethod
  public async rejectsAListingWhoseCallEndsWhileAnAppIsBeingDescribed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const controller = new AbortController();
    host.appDescriptions.unanswered.add("com.example.mail");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.mail", Resources.formatToolScope("c1", null), new Date())];

    const listing = host.computerUseGrants.listAsync(controller.signal);
    controller.abort();

    await Assert.throwsAsync(() => listing, Error);
    Assert.isTrue(host.appDescriptions.signals[0]?.aborted ?? false);
  }

  @TestMethod
  public async listsTheIdentitiesAloneWithoutAnyDescriptions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];
    const service = new ComputerUseGrantsService(host.rememberedGrants, host.conversations, host.teammates, null,
      new ComputerUseGrantTimings(1_000, 60_000), host.timer);

    const listed = await service.listAsync();

    Assert.areEqual(JSON.stringify([["com.example.notes", null, null]]), JSON.stringify(listed.map(t => [t.app, t.appName, t.appIcon])));
  }

  @TestMethod
  public async rejectsAListingWhoseCallEnded(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];

    await Assert.throwsAsync(() => host.computerUseGrants.listAsync(AbortSignal.abort()), Error);
  }

  @TestMethod
  public async listsAGrantWhoseScopeIsAChatAloneWithThatChatAndNoTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync(await host.openProjectAsync(), "Release notes");
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", chat.id, new Date("2026-10-29T10:00:00.000Z"))];

    const listed = await host.computerUseGrants.listAsync();

    Assert.areEqual(JSON.stringify([{ id: "g1", chatId: chat.id, chatTitle: "Release notes", teammateName: null, app: "com.example.notes", appName: null,
      appIcon: null, grantedAt: "2026-10-29T10:00:00.000Z" }]), JSON.stringify(listed.map(t => t.toJson())));
  }

  @TestMethod
  public async revokesAListedGrantThroughTheCenterAndNoOtherId(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope(chat.id, null), new Date("2026-10-29T10:00:00.000Z")),
      new RememberedAppGrant("g2", "com.example.mail", Resources.formatToolScope(chat.id, null), new Date("2026-10-29T11:00:00.000Z"))
    ];

    host.computerUseGrants.revoke(new ComputerUseGrantIdParams("g1"));
    const again = Assert.throws(() => host.computerUseGrants.revoke(new ComputerUseGrantIdParams("g1")), ServiceException);
    const other = Assert.throws(() => host.computerUseGrants.revoke(new ComputerUseGrantIdParams("other-module")), ServiceException);

    Assert.areEqual("g2", (await host.computerUseGrants.listAsync()).map(t => t.id).join(","));
    Assert.areEqual(JSON.stringify(["g1"]), JSON.stringify(host.rememberedGrants.revoked));
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, ["g1"]]), JSON.stringify([again.info.name, again.info.arguments]));
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, ["other-module"]]), JSON.stringify([other.info.name, other.info.arguments]));
  }

  @TestMethod
  public async reportsAGrantTheCenterNoLongerHoldsAsNotFound(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.rememberedGrants.grants = [new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), new Date())];
    host.rememberedGrants.revoke = (): boolean => false;

    const missing = Assert.throws(() => host.computerUseGrants.revoke(new ComputerUseGrantIdParams("g1")), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, missing.info.name);
  }

  @TestMethod
  public async forgetsEveryGrantOfTheDeletedChatsForAnyTeammateAndKeepsOtherChats(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const date = new Date("2026-10-29T10:00:00.000Z");
    host.rememberedGrants.grants = [
      new RememberedAppGrant("g1", "com.example.notes", Resources.formatToolScope("c1", null), date),
      new RememberedAppGrant("g2", null, Resources.formatToolScope("c1", "t1"), date),
      new RememberedAppGrant("g3", "com.example.mail", "c2", date),
      new RememberedAppGrant("g4", "com.example.notes", Resources.formatToolScope("c10", null), date),
      new RememberedAppGrant("g5", "com.example.paint", Resources.formatToolScope("c3", null), date)
    ];

    host.computerUseGrants.forget(["c1", "c2"]);
    host.computerUseGrants.forget([]);

    Assert.areEqual("g1,g2,g3", host.rememberedGrants.revoked.join(","));
    Assert.areEqual("g4,g5", host.rememberedGrants.grants.map(t => t.id).join(","));
  }
}
