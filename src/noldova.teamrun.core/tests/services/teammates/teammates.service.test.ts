/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, type IOrganizationService, Resources, TeammatesService } from "@noldova/teamrun.core";
import { ComposerDefaultSaveParams, DepartmentCreateParams, DepartmentMemberSetParams, DepartmentUpdateParams, ContextUsage, ConversationIdParams, ConversationMemberParams, DefaultTeammate, DefaultTeammateSetParams, ErrorCode, Harness, Message, MessageAuthor,
  MessageSendParams, MessageStatus, ObservedSettings, Provenance, ProviderIdParams, ReplyUsage, RequestedSettings, TeammateCreateParams, TeammateFallback, TeammateIdParams,
  TeammateMention, TeammateUpdateParams } from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class TeammatesServiceTests {
  @TestMethod
  public async keepsATeammatesChosenSpeedThroughCreateAndAnUpdateThatLeavesItOutAndClearsItOnlyWhenNamedAsNull(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const created = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "model", null, "priority"));
    const kept = (await host.teammates.findAsync(created.id))?.speed;
    await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "Ada", null, provider.id, Harness.Provider, "model", null));
    const left = (await host.teammates.findAsync(created.id))?.speed;
    await host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { speed: null }, provider.id));

    Assert.areEqual("priority|priority|priority|null", [created.speed, kept, left, String((await host.teammates.findAsync(created.id))?.speed)].join("|"));
  }

  @TestMethod
  public async keepsATeammatesChosenModeThroughCreateAndAnUpdateThatLeavesItOutAndClearsItOnlyWhenNamedAsNull(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const created = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, "model", null, null, "plan"));
    const kept = (await host.teammates.findAsync(created.id))?.mode;
    await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "Ada", null, provider.id, Harness.Provider, "model", null, null, "acceptEdits"));
    const changed = (await host.teammates.findAsync(created.id))?.mode;
    await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "Ada", null, provider.id, Harness.Provider, "model", null));
    const left = (await host.teammates.findAsync(created.id))?.mode;
    await host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { mode: null }, provider.id));

    Assert.areEqual("plan|plan|acceptEdits|acceptEdits|null",
      [created.mode, kept, changed, left, String((await host.teammates.findAsync(created.id))?.mode)].join("|"));
  }

  @TestMethod
  public async keepsBothChangesOfTwoWritersThatChangeDifferentFieldsOfOneTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const created = await host.teammates.createAsync(new TeammateCreateParams("Ada", "Review", provider.id, Harness.Provider, "model", "low", "priority", "plan"));
    const window = TeammateUpdateParams.changing(created, { model: "other", effort: "low" })!;
    const teammate = TeammateUpdateParams.of(created.id, { effort: "high" }, provider.id);

    await host.teammates.updateAsync(teammate);
    const updated = await host.teammates.updateAsync(window);

    Assert.areEqual(JSON.stringify(["Ada", "Review", provider.id, "other", "high", "priority", "plan"]),
      JSON.stringify([updated.name, updated.role, updated.providerId, updated.model, updated.effort, updated.speed, updated.mode]));
    Assert.areEqual(JSON.stringify(updated.toJson()), JSON.stringify((await host.teammates.findAsync(created.id))?.toJson()));
  }

  @TestMethod
  public async refusesAModelChosenUnderAProviderTheTeammateHasSinceLeftAndKeepsTheMove(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = await host.createProviderAsync();
    const second = await host.createProviderAsync("fake", "Home");
    const created = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, first.id, Harness.Provider, "model", "low", "priority", "plan"));
    const chosen = TeammateUpdateParams.changing(created, { model: "first-only", speed: null })!;

    await host.teammates.updateAsync(TeammateUpdateParams.changing(created, { providerId: second.id, model: null, effort: null, speed: null, mode: null })!);
    const refusal = await Assert.throwsAsync(() => host.teammates.updateAsync(chosen), ServiceException);
    const moved = (await host.teammates.findAsync(created.id))!;
    const later = await host.teammates.updateAsync(TeammateUpdateParams.changing(moved, { model: "second-model" })!);

    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, Resources.formatTeammateProviderChanged("Ada"), [created.id]]),
      JSON.stringify([refusal.info.name, refusal.info.message, refusal.info.arguments]));
    Assert.areEqual(JSON.stringify([second.id, null, null]), JSON.stringify([moved.providerId, moved.model, moved.speed]));
    Assert.areEqual(JSON.stringify([second.id, "second-model"]), JSON.stringify([later.providerId, later.model]));
  }

  @TestMethod
  public async keepsTheLaterOfTwoWritersThatChangeTheSameFieldAndAnOlderClientsFullUpdateStillReplacesEveryField(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const other = await host.createProviderAsync("fake", "Home");
    const created = await host.teammates.createAsync(new TeammateCreateParams("Ada", "Review", provider.id, Harness.Provider, "model", "low", "priority", "plan"));

    await host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { effort: "medium" }, provider.id));
    const later = await host.teammates.updateAsync(TeammateUpdateParams.of(created.id, { effort: "high" }, provider.id));
    const full = await host.teammates.updateAsync(TeammateUpdateParams.fromJson({
      teammateId: created.id, name: "Bea", role: null, providerId: other.id, harness: Harness.Provider, model: null, effort: null, speed: null, mode: null
    }));

    Assert.areEqual("high", later.effort);
    Assert.areEqual(JSON.stringify(["Bea", null, other.id, null, null, null, null]),
      JSON.stringify([full.name, full.role, full.providerId, full.model, full.effort, full.speed, full.mode]));
  }

  @TestMethod
  public async persistsUniqueNamesAndAllowsUnavailableProvidersToRemainReferenced(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const created = await host.teammates.createAsync(new TeammateCreateParams("Équipe", "Review", provider.id, Harness.Provider, "model", "high"));
    Assert.areEqual(created.id, (await host.teammates.listAsync())[0]?.id);
    Assert.areEqual("Équipe", (await host.teammates.findAsync(created.id))?.name);
    Assert.isNull(await host.teammates.findAsync("missing"));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.teammates.createAsync(
      new TeammateCreateParams("ÉQUIPE".normalize("NFD"), null, provider.id, Harness.Provider, null, null)), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.teammates.createAsync(
      new TeammateCreateParams("Bob", null, "missing", Harness.Provider, null, null)), ServiceException)).info.name);
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, provider.id, Harness.Provider, null, null));
    await Assert.throwsAsync(() => host.teammates.updateAsync(
      new TeammateUpdateParams(bob.id, "équipe", null, provider.id, Harness.Provider, null, null)), ServiceException);
    const edited = await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "ÉQUIPE", null, provider.id, Harness.Provider, null, null));
    Assert.areEqual(created.id, edited.id);
    Assert.areEqual(created.createdAt, edited.createdAt);
    await host.providers.deleteAsync(new ProviderIdParams(provider.id));
    Assert.areEqual(provider.id, (await host.teammates.findAsync(created.id))?.providerId);
    await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "Renamed", null, provider.id, Harness.Provider, null, null));
    await Assert.throwsAsync(() => host.teammates.updateAsync(
      new TeammateUpdateParams(created.id, "Renamed", null, "missing", Harness.Provider, null, null)), ServiceException);
    await Assert.throwsAsync(() => host.teammates.updateAsync(
      new TeammateUpdateParams("missing", "Nobody", null, provider.id, Harness.Provider, null, null)), ServiceException);
    const record = (await host.context.database.connection.queryAsync(new SqlQuery("SELECT name FROM teammates WHERE id = ?", [created.id])))[0];
    Assert.areEqual("renamed", record?.readString("name"));
  }

  @TestMethod
  public async createsAndRenamesTeammatesWhoseNamesHaveMarks(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const created = await host.teammates.createAsync(new TeammateCreateParams("राहुल शर्मा", null, provider.id, Harness.Provider, null, null));
    Assert.areEqual("राहुल शर्मा", (await host.teammates.findAsync(created.id))?.name);
    await host.teammates.updateAsync(new TeammateUpdateParams(created.id, "สมศักดิ์ ใจดี", null, provider.id, Harness.Provider, null, null));
    Assert.areEqual("สมศักดิ์ ใจดี", (await host.teammates.findAsync(created.id))?.name);
    await host.teammates.createAsync(new TeammateCreateParams("\u095E\u0930\u093E\u091C\u093C", null, provider.id, Harness.Provider, null, null));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.teammates.createAsync(
      new TeammateCreateParams("\u092B\u093C\u0930\u093E\u091C\u093C", null, provider.id, Harness.Provider, null, null)), ServiceException)).info.name);
  }

  @TestMethod
  public async listsTheTeammatesByNameIgnoringCaseWithAnAccentedNameBesideItsLetter(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();

    for (const name of ["zoe", "Émile", "bob", "Alice", "edgar"])
      await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null));

    Assert.areEqual(["Alice", "bob", "edgar", "Émile", "zoe"].join(), (await host.teammates.listAsync()).map(t => t.name).join());
  }

  @TestMethod
  public async keepsNamesWithSpacesUniqueRegardlessOfCase(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Code Reviewer", null, provider.id, Harness.Provider, null, null));
    const code = await host.teammates.createAsync(new TeammateCreateParams("Code", null, provider.id, Harness.Provider, null, null));
    Assert.areEqual("Code Reviewer", (await host.teammates.findAsync(reviewer.id))?.name);
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.teammates.createAsync(
      new TeammateCreateParams("code REVIEWER", null, provider.id, Harness.Provider, null, null)), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.teammates.updateAsync(
      new TeammateUpdateParams(code.id, "CODE reviewer", null, provider.id, Harness.Provider, null, null)), ServiceException)).info.name);
    Assert.areEqual("Code Reviewer Lead", (await host.teammates.updateAsync(
      new TeammateUpdateParams(code.id, "Code Reviewer Lead", null, provider.id, Harness.Provider, null, null))).name);
  }

  @TestMethod
  public async keepsATeammatesUsageThroughAModelChangeAndDropsItWhenAProviderChangeStartsANewSession(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = await host.createProviderAsync();
    const second = await host.createProviderAsync("fake", "Second");
    const conversation = await host.createConversationAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, first.id, Harness.Provider, null, null));
    host.adapter.usage = new ReplyUsage(100, 10, null, new ContextUsage(5000, 200_000, null));
    const ask = async (): Promise<string> => {
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice check", null, null, [], [alice.id]));
      await host.engine.waitForIdle();
      return sent.replies[0]!.id;
    };
    const listed = async (): Promise<string> => (await host.messages.listTeammateUsageAsync()).map(t => t.messageId).join("|");

    const before = await ask();
    await host.teammates.updateAsync(new TeammateUpdateParams(alice.id, "Alice", null, first.id, Harness.Provider, "fake-large", "high"));
    const kept = await listed();
    await host.teammates.updateAsync(new TeammateUpdateParams(alice.id, "Alice", null, second.id, Harness.Provider, "fake-large", "high"));
    const reset = await listed();
    const after = await ask();

    Assert.areEqual(before, kept);
    Assert.areEqual(String.empty, reset);
    Assert.areEqual(after, await listed());
  }

  @TestMethod
  public async resetsSessionsOnRebindingAndPreservesMessageIdentityAfterDeletion(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const first = await host.createProviderAsync();
    const second = await host.createProviderAsync("fake", "Second");
    const conversation = await host.createConversationAsync();
    const teammate = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, first.id, Harness.Provider, null, null));
    const member = new ConversationMemberParams(conversation.id, teammate.id);
    await host.conversations.addMemberAsync(member);
    await host.conversations.setMemberSessionAsync(member, "native-1", true);
    await host.teammates.updateAsync(new TeammateUpdateParams(teammate.id, "Renamed", "role", second.id, Harness.Provider, "m", "low"));
    Assert.isNull((await host.conversations.findMemberAsync(member))?.nativeSessionId);
    const provenance = new Provenance(first.id, new RequestedSettings("fake", null, null),
      new ObservedSettings(null, null, null, null), null, false);
    const user = new Message("user", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t",
      [], null, null, [new TeammateMention(teammate.id, "Alice")]);
    const reply = new Message("reply", conversation.id, 1, MessageAuthor.Provider, user.id, MessageStatus.Completed, [],
      provenance, "t", "t", "t", [], teammate.id, "Alice");
    await host.messages.insertAsync(user);
    await host.messages.insertAsync(reply);
    Assert.isFalse(await host.teammates.deleteAsync(new TeammateIdParams(teammate.id)));
    Assert.isNull(await host.teammates.findAsync(teammate.id));
    Assert.areEqual(0, (await host.conversations.listMembersAsync(new ConversationIdParams(conversation.id))).length);
    Assert.areEqual("Alice", (await host.messages.findAsync(reply.id))?.teammateName);
    Assert.areEqual(teammate.id, (await host.messages.findAsync(reply.id))?.teammateId);
    Assert.areEqual("Alice", (await host.messages.findAsync(user.id))?.mentions[0]?.name);
    const changes = await host.context.database.changeFeed.readAfterAsync(0);
    Assert.isTrue(changes.some(t => t.entity === ChangeEntity.ChatMember && t.operation === ChangeOperation.Update));
    Assert.isTrue(changes.some(t => t.entity === ChangeEntity.ChatMember && t.operation === ChangeOperation.Delete));
    Assert.areEqual(ChangeEntity.Teammate, changes.at(-1)?.entity);
    Assert.areEqual(ChangeOperation.Delete, changes.at(-1)?.operation);
    await Assert.throwsAsync(() => host.teammates.deleteAsync(new TeammateIdParams(teammate.id)), ServiceException);
  }

  @TestMethod
  public async takesADeletedLeaderOutOfItsDepartmentAndItsLeadershipInTheDeletingTransaction(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, provider.id, Harness.Provider, null, null));
    const design = await host.organization.createAsync(new DepartmentCreateParams("Design", null));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(ada.id, design.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(design.id, undefined, ada.id));
    const organization = host.organization;
    const failing: IOrganizationService = {
      listAsync: t => organization.listAsync(t),
      createAsync: t => organization.createAsync(t),
      updateAsync: t => organization.updateAsync(t),
      moveAsync: t => organization.moveAsync(t),
      deleteAsync: t => organization.deleteAsync(t),
      setMemberAsync: t => organization.setMemberAsync(t),
      removeTeammateAsync: async (teammateId, transaction) => {
        await organization.removeTeammateAsync(teammateId, transaction);
        throw new Error("The delete failed after the teammate left its department.");
      }
    };

    await Assert.throwsAsync(() => new TeammatesService(host.context, host.providers, host.conversations, failing).deleteAsync(new TeammateIdParams(ada.id)), Error);
    const kept = await host.organization.listAsync();
    const departed = await host.teammates.deleteAsync(new TeammateIdParams(ada.id));
    const left = await host.organization.listAsync();

    Assert.areEqual(`${ada.id},${design.id}`, `${kept.departments[0]?.leaderId},${kept.departmentOf(ada.id)}`);
    Assert.isNull(left.departments[0]?.leaderId);
    Assert.isNull(left.departmentOf(ada.id));
    Assert.isTrue(departed);
    Assert.isNull(await host.teammates.findAsync(ada.id));
  }

  @TestMethod
  public async keepsOneDefaultTeammateWithAProviderOfItsProviderAndRecordsEachChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const chosen = new DefaultTeammate(new RequestedSettings("fake", "fake-b", "high"), provider.id);
    const unchosen = new DefaultTeammate(new RequestedSettings("other", null, null));
    const entries = async (): Promise<string> => (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Preference)
      .map(t => `${t.entityId} ${t.operation}`).join(",");

    Assert.isNull(await host.teammates.readDefaultAsync());
    Assert.isNull(await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(null)));
    Assert.areEqual(JSON.stringify(chosen.toJson()), JSON.stringify((await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(chosen)))?.toJson()));
    Assert.areEqual(JSON.stringify(chosen.toJson()), JSON.stringify((await host.teammates.readDefaultAsync())?.toJson()));
    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(unchosen));
    Assert.areEqual(JSON.stringify(unchosen.toJson()), JSON.stringify((await host.teammates.readDefaultAsync())?.toJson()));
    Assert.isNull(await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(null)));
    Assert.isNull(await host.teammates.readDefaultAsync());
    Assert.areEqual("defaultTeammate Insert,defaultTeammate Update,defaultTeammate Delete", await entries());
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.teammates.setDefaultAsync(
      new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("fake", null, null), "missing"))), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.teammates.setDefaultAsync(
      new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("other", null, null), provider.id))), ServiceException)).info.name);
    Assert.isNull(await host.teammates.readDefaultAsync());
  }

  @TestMethod
  public async keepsTheComposerDefaultAsItIsAndSavesAMovedOneOnlyIfNoneIsKept(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const moved = { kind: "codex", model: "gpt-5", effort: null, providerId: "a1", responderTeammateId: null };
    const sent = { kind: "claude", model: "opus", effort: "max", providerId: "a2", responderTeammateId: null };
    const entries = async (): Promise<string> => (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.Preference)
      .map(t => `${t.entityId} ${t.operation} ${t.payload}`).join(",");

    Assert.isNull(await host.teammates.readComposerDefaultAsync());
    Assert.areEqual(JSON.stringify(moved), JSON.stringify(await host.teammates.saveComposerDefaultAsync(new ComposerDefaultSaveParams(moved, true))));
    Assert.areEqual(JSON.stringify(sent), JSON.stringify(await host.teammates.saveComposerDefaultAsync(new ComposerDefaultSaveParams(sent))));
    Assert.areEqual(JSON.stringify(sent), JSON.stringify(await host.teammates.saveComposerDefaultAsync(new ComposerDefaultSaveParams(moved, true))));

    Assert.areEqual(JSON.stringify(sent), JSON.stringify(await host.teammates.readComposerDefaultAsync()));
    Assert.areEqual([`composerDefault ${ChangeOperation.Insert} ${JSON.stringify(moved)}`, `composerDefault ${ChangeOperation.Update} ${JSON.stringify(sent)}`].join(","),
      await entries());
  }

  @TestMethod
  public async givesADefaultTeammateWhoseSettingsNameNoProviderTheProviderFoundForItsKind(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const found = (kind: string): Promise<string | null> => Promise.resolve(kind === "fake" ? provider.id : null);

    Assert.isNull(await host.teammates.moveProviderlessDefaultAsync(found));

    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("other", null, null))));

    Assert.isNull(await host.teammates.moveProviderlessDefaultAsync(found));
    Assert.isNull((await host.teammates.readDefaultAsync())?.providerId);

    await host.teammates.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings("fake", "fake-b", "high"))));
    const moved = await host.teammates.moveProviderlessDefaultAsync(found);

    Assert.areEqual(`fake fake-b high ${provider.id}`, `${moved?.requested.kind} ${moved?.requested.model} ${moved?.requested.effort} ${moved?.providerId}`);
    Assert.areEqual(provider.id, (await host.teammates.readDefaultAsync())?.providerId);
    Assert.isNull(await host.teammates.moveProviderlessDefaultAsync(() => Promise.resolve("another")));
    Assert.areEqual(provider.id, (await host.teammates.readDefaultAsync())?.providerId);
  }

  @TestMethod
  public async keepsAnOrderedUsageHandOffListAndRefusesATeammateThatDoesNotExist(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Reviewer", null, provider.id, Harness.Provider, null, null));
    const tester = await host.teammates.createAsync(new TeammateCreateParams("Tester", null, provider.id, Harness.Provider, null, null));
    const builder = await host.teammates.createAsync(new TeammateCreateParams("Builder", null, provider.id, Harness.Provider, null, null, null, null, null,
      [tester.id, reviewer.id]));
    const created = (await host.teammates.findAsync(builder.id))?.usageHandOffs.join("|");
    await host.teammates.updateAsync(TeammateUpdateParams.of(builder.id, { usageHandOffs: [reviewer.id] }));
    const changed = (await host.teammates.findAsync(builder.id))?.usageHandOffs.join("|");
    await host.teammates.updateAsync(TeammateUpdateParams.of(builder.id, { role: "Build" }));

    Assert.areEqual([`${tester.id}|${reviewer.id}`, reviewer.id, reviewer.id].join(","),
      [created, changed, (await host.teammates.findAsync(builder.id))?.usageHandOffs.join("|")].join(","));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.teammates.createAsync(new TeammateCreateParams("Other", null, provider.id, Harness.Provider, null, null,
      null, null, null, [reviewer.id, "missing"])), ServiceException)).info.name);
    Assert.isUndefined((await host.teammates.listAsync()).find(t => t.name === "Other"));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.teammates.updateAsync(TeammateUpdateParams.of(builder.id, { usageHandOffs: ["missing"] })),
      ServiceException)).info.name);
    Assert.areEqual(reviewer.id, (await host.teammates.findAsync(builder.id))?.usageHandOffs.join("|"));
  }

  @TestMethod
  public async keepsEverySustainSettingOfATeammateItTakesADeletedTeammateOrProviderOff(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const personal = await host.createProviderAsync("fake", "Personal");
    const team = await host.createProviderAsync("fake", "Team");
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Reviewer", null, provider.id, Harness.Provider, null, null));
    const tester = await host.teammates.createAsync(new TeammateCreateParams("Tester", null, provider.id, Harness.Provider, null, null));
    const builder = await host.teammates.createAsync(new TeammateCreateParams("Builder", null, provider.id, Harness.Provider, null, null, null, null, null,
      [reviewer.id, tester.id], true, [new TeammateFallback(personal.id, "fake-large", "high"), new TeammateFallback(team.id)], false));
    const described = async (): Promise<string> => {
      const kept = await host.teammates.findAsync(builder.id);
      return [kept?.usageHandOffs.join(","), String(kept?.sustain), kept?.fallbacks.map(t => [t.providerId, t.model, t.effort].join(" ")).join(","),
        String(kept?.resetsSoonestFirst)].join("|");
    };

    await host.teammates.deleteAsync(new TeammateIdParams(reviewer.id));
    const afterTeammate = await described();
    await host.providers.deleteAsync(new ProviderIdParams(team.id));

    Assert.areEqual(`${tester.id}|true|${personal.id} fake-large high,${team.id}  |false`, afterTeammate);
    Assert.areEqual(`${tester.id}|true|${personal.id} fake-large high|false`, await described());
  }

  @TestMethod
  public async takesADeletedTeammateOffEveryUsageHandOffListAndRecordsEachChangedTeammate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync();
    const reviewer = await host.teammates.createAsync(new TeammateCreateParams("Reviewer", null, provider.id, Harness.Provider, null, null));
    const tester = await host.teammates.createAsync(new TeammateCreateParams("Tester", null, provider.id, Harness.Provider, null, null));
    const builder = await host.teammates.createAsync(new TeammateCreateParams("Builder", null, provider.id, Harness.Provider, null, null, null, null, null,
      [reviewer.id, tester.id]));
    const planner = await host.teammates.createAsync(new TeammateCreateParams("Planner", null, provider.id, Harness.Provider, null, null, null, null, null, [tester.id]));
    const before = (await host.context.database.changeFeed.readAfterAsync(0)).length;

    await host.teammates.deleteAsync(new TeammateIdParams(reviewer.id));
    const changes = (await host.context.database.changeFeed.readAfterAsync(0)).slice(before);

    Assert.areEqual(tester.id, (await host.teammates.findAsync(builder.id))?.usageHandOffs.join("|"));
    Assert.areEqual(tester.id, (await host.teammates.findAsync(planner.id))?.usageHandOffs.join("|"));
    Assert.areEqual([`${reviewer.id}:${ChangeOperation.Delete}`, `${builder.id}:${ChangeOperation.Update}`].join(","),
      changes.filter(t => t.entity === ChangeEntity.Teammate).map(t => `${t.entityId}:${t.operation}`).join(","));
  }
}
