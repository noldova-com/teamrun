/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, OrganizationMessagesService, Resources, SignInCheck } from "@noldova/teamrun.core";
import {
  AuthStatus, Chat, ConversationIdParams, type Department, DepartmentCreateParams, DepartmentMemberSetParams, DepartmentUpdateParams, DetailKind, ErrorCode,
  EventName, Harness, MessageAuthor, MessageIdParams, MessageListParams, MessageSendParams, MessageStatus, MethodName, type OrganizationMessage, OrganizationMessageSendParams,
  OrganizationTarget, ProviderIdParams, Request, type Teammate, TeammateCreateParams, TeammateIdParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeOrganizationSender } from "../../fixtures/fake-organization-sender.fixture.js";

@TestClass
export class OrganizationMessagesServiceTests {
  @TestMethod
  public async opensATeammatesOrganizationChatOnceWithoutSendingAndTellsTheTeammateItsPlaceWithEachOfThePersonsMessagesThere(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const grok = await OrganizationMessagesServiceTests.teammateAsync(host, "Grok");
    const invalidated = host.listener.count(EventName.StateInvalidated);
    const open = (teammateId: string): ReturnType<CoreHost["dispatcher"]["dispatch"]> =>
      host.dispatcher.dispatch(new Request("r", MethodName.OrganizationChatOpen, new TeammateIdParams(teammateId).toJson()));

    const opened = Chat.fromJson((await open(grok.id)).payload);
    const again = Chat.fromJson((await open(grok.id)).payload);
    const made = host.listener.count(EventName.StateInvalidated);
    const unknown = await open("gone");
    const sent = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.teammate(grok.id), "Hi"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(opened.id, "Direct", null, null, [], [], grok.id));
    await host.engine.waitForIdle();
    const members = await host.conversations.listMembersAsync(new ConversationIdParams(opened.id));
    const told = (text: string): boolean => host.adapter.requests.some(t =>
      t.prompt.includes(Resources.formatOrganizationMessagePrompt(Resources.organizationNoDepartment, Resources.organizationReportsToPerson, text)));

    Assert.areEqual(JSON.stringify([Resources.formatOrganizationChatTitle("Grok"), null, Resources.defaultOrganizationId, grok.id, [grok.id]]),
      JSON.stringify([opened.title, opened.projectId, opened.organizationChat?.organizationId, opened.organizationChat?.teammateId, members.map(t => t.teammateId)]));
    Assert.areEqual(`${opened.id} ${opened.id}`, `${again.id} ${sent.recipients[0]?.chatId}`);
    Assert.areEqual(invalidated + 1, made);
    Assert.areEqual(ErrorCode.NotFound, unknown.info?.name);
    Assert.areEqual("true true 2", `${told("Hi")} ${told("Direct")} ${host.adapter.requests.length}`);
  }

  @TestMethod
  public async sendsADepartmentMessageAsThePersonToItsLeaderThenItsDirectMembersEachInItsOrganizationChatTellingItsPlace(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const carol = await OrganizationMessagesServiceTests.teammateAsync(host, "Carol");
    const design = await OrganizationMessagesServiceTests.departmentAsync(host, "Design", null, [ada, bob], bob);
    await OrganizationMessagesServiceTests.departmentAsync(host, "Fonts", design.id, [carol], null);
    const updated = host.listener.count(EventName.OrganizationMessageUpdated);

    const sent = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.department(design.id), "Status?"));
    await host.engine.waitForIdle();
    const first = await host.messages.findAsync(String(sent.recipients[0]?.messageId));

    Assert.areEqual("Bob:Started,Ada:Started", OrganizationMessagesServiceTests.states(sent));
    Assert.isTrue(sent.recipients.every(t => !Object.isNull(t.chatId) && !Object.isNull(t.messageId)));
    const chat = await host.conversations.findAsync(String(first?.chatId));
    const prompts = [Resources.formatOrganizationMessagePrompt(Resources.formatOrganizationLeader("Design"), Resources.organizationReportsToPerson, "Status?"),
      Resources.formatOrganizationMessagePrompt(Resources.formatOrganizationMember("Design"), "Bob", "Status?")];
    Assert.areEqual(`${MessageAuthor.User} null Status? ${Resources.formatOrganizationChatTitle("Bob")} ${Resources.defaultOrganizationId} ${bob.id}`,
      `${first?.author} ${first?.sender} ${first?.details[0]?.text} ${chat?.title} ${chat?.organizationChat?.organizationId} ${chat?.organizationChat?.teammateId}`);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(prompts.map(t => host.adapter.requests.some(u => u.prompt.includes(t)))));
    Assert.areEqual(JSON.stringify([sent.toJson()]), JSON.stringify((await host.organizationMessages.listAsync()).map(t => t.toJson())));
    Assert.areEqual("Insert,Update,Update", await OrganizationMessagesServiceTests.feedAsync(host));
    Assert.areEqual(updated + 3, host.listener.count(EventName.OrganizationMessageUpdated));

    const again = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.teammate(bob.id), "Again"));
    await host.engine.waitForIdle();

    Assert.areEqual(sent.recipients[0]?.chatId, again.recipients[0]?.chatId);
  }

  @TestMethod
  public async sendsToOneTeammateTheLeadersOrEveryoneAndRefusesAnUnknownTargetOrMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const carol = await OrganizationMessagesServiceTests.teammateAsync(host, "Carol");
    await OrganizationMessagesServiceTests.departmentAsync(host, "Design", null, [ada, bob], ada);
    const empty = await OrganizationMessagesServiceTests.departmentAsync(host, "Empty", null, [], null);
    const sender = await OrganizationMessagesServiceTests.senderAsync(host, [ada, bob, carol]);
    const service = OrganizationMessagesServiceTests.service(host, sender);

    const one = await service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.teammate(bob.id), "One"));
    const leaders = await service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.leaders, "Leaders"));
    const everyone = await service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "All"));
    const nobody = await service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.department(empty.id), "None"));

    Assert.areEqual("Bob:Started|Ada:Started|Ada:Started,Bob:Started,Carol:Started|",
      [one, leaders, everyone, nobody].map(t => OrganizationMessagesServiceTests.states(t)).join("|"));
    Assert.areEqual(`${Resources.defaultOrganizationId}:${bob.id}:One ${Resources.defaultOrganizationId}:${carol.id}:All`,
      `${sender.sends[0]} ${sender.sends.find(t => t.includes(`:${carol.id}:`))}`);
    Assert.areEqual(5, sender.sends.length);
    await OrganizationMessagesServiceTests.failsAsync(() => service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.teammate("gone"), "Hi")));
    await OrganizationMessagesServiceTests.failsAsync(() => service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.department("gone"), "Hi")));
    await OrganizationMessagesServiceTests.failsAsync(() => service.stopAsync(new MessageIdParams("gone")));
    Assert.areEqual(4, (await service.listAsync()).length);
  }

  @TestMethod
  public async stopsTheRecipientsNotYetStartedAndTheRepliesStillWaitingAndCancelsTheRepliesOfASendThatLandsAfterTheStop(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const sender = await OrganizationMessagesServiceTests.senderAsync(host, [ada, bob]);
    const service = OrganizationMessagesServiceTests.service(host, sender);
    let release = (): void => undefined;
    sender.holds.set(bob.id, new Promise(resolve => { release = resolve; }));

    const sending = service.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Hold on"));
    await host.until("Ada's start", async () => (await service.listAsync()).map(t => OrganizationMessagesServiceTests.states(t)).join() === "Ada:Started,Bob:Queued");
    const id = String((await service.listAsync())[0]?.id);
    const stopped = await service.stopAsync(new MessageIdParams(id));
    const cancelledFirst = [...sender.cancels];
    release();
    const sent = await sending;
    const late = await host.messages.findAsync(`r1-${bob.id}`);

    Assert.areEqual("Ada:Stopped,Bob:Stopped", OrganizationMessagesServiceTests.states(stopped));
    Assert.areEqual(`r1-${ada.id}`, cancelledFirst.join());
    Assert.areEqual("Ada:Stopped,Bob:Stopped", OrganizationMessagesServiceTests.states(sent));
    Assert.areEqual(`u0-${bob.id}`, sent.recipients[1]?.messageId);
    Assert.areEqual(MessageStatus.Cancelled, late?.status);
    Assert.areEqual(`r1-${ada.id},r1-${bob.id}`, sender.cancels.join());
  }

  @TestMethod
  public async stopsFromAnotherInstanceOnlyTheRepliesStillWaitingAndLeavesARunningReplyStarted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const sender = await OrganizationMessagesServiceTests.senderAsync(host, [ada, bob]);
    const sent = await OrganizationMessagesServiceTests.service(host, sender).sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Go"));
    const running = await host.messages.findAsync(`r1-${ada.id}`);
    if (Object.isNull(running))
      throw new Error("There is no reply from Ada.");
    await host.messages.updateAsync(running.withStart("t"));

    const stopped = await OrganizationMessagesServiceTests.service(host, sender).stopAsync(new MessageIdParams(sent.id));
    const again = await OrganizationMessagesServiceTests.service(host, sender).stopAsync(new MessageIdParams(sent.id));

    Assert.areEqual("Ada:Started,Bob:Stopped", OrganizationMessagesServiceTests.states(stopped));
    Assert.areEqual(`r1-${bob.id}`, sender.cancels.join());
    Assert.areEqual(JSON.stringify(stopped.toJson()), JSON.stringify(again.toJson()));
  }

  @TestMethod
  public async failsARecipientWhoseAccountCantReplyNamingTheAccountAndSendsItNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const out = await host.createProviderAsync("fake", "Spare");
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, out.id, Harness.Provider, null, null));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(out.id));
    const gone = await host.createProviderAsync("fake", "Gone");
    const cid = await host.teammates.createAsync(new TeammateCreateParams("Cid", null, gone.id, Harness.Provider, null, null));
    await host.providers.deleteAsync(new ProviderIdParams(gone.id));

    const sent = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Status?"));
    await host.engine.waitForIdle();

    Assert.areEqual(`Ada:Started:null,Bob:Failed:${Resources.formatAccountCannotReply("Bob", "Spare")},`
      + `Cid:Failed:${Resources.formatAccountCannotReply("Cid", null)}`,
      sent.recipients.map(t => `${t.teammateName}:${t.state}:${t.reason}`).join());
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(ada.id, sent.recipients[0]?.teammateId);
    Assert.isNull(sent.recipients.find(t => t.teammateId === bob.id)?.chatId);
    Assert.isNull(sent.recipients.find(t => t.teammateId === cid.id)?.chatId);
  }

  @TestMethod
  public async queuesAMessageToATeammateStillAnsweringBehindItsRunningReplyWhereStopCanHaltIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    host.adapter.holdTurn = () => held;
    const send = (text: string): Promise<OrganizationMessage> =>
      host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.teammate(ada.id), text));

    await send("First");
    await host.until("the first reply's run", async () => (await host.messages.listOpenAsync()).some(t => t.status === MessageStatus.Running), host.runs());
    const second = await send("Second");
    const third = await send("Third");
    const waiting = (await host.messages.listOpenAsync()).filter(t => t.status === MessageStatus.Pending).length;
    const stopped = await host.organizationMessages.stopAsync(new MessageIdParams(third.id));
    release();
    await host.engine.waitForIdle();
    const replyTo = async (message: OrganizationMessage): Promise<MessageStatus | undefined> =>
      (await host.messages.listAsync(new MessageListParams(String(message.recipients[0]?.chatId), null)))
        .find(t => t.inReplyTo === message.recipients[0]?.messageId)?.status;

    Assert.areEqual("Started,Started,Stopped", [second, third, stopped].map(t => t.recipients[0]?.state).join());
    Assert.areEqual(2, waiting);
    Assert.areEqual(`${MessageStatus.Completed},${MessageStatus.Cancelled}`, [await replyTo(second), await replyTo(third)].join());
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes("Second") ?? false);
  }

  @TestMethod
  public async failsTheRecipientsAQuitLeftQueuedOnceStartedAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const sender = await OrganizationMessagesServiceTests.senderAsync(host, [ada, bob]);
    sender.holds.set(bob.id, new Promise(() => undefined));
    void OrganizationMessagesServiceTests.service(host, sender).sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Bye"));
    await host.until("Ada's start", async () => (await host.organizationMessages.listAsync()).map(t => OrganizationMessagesServiceTests.states(t)).join()
      === "Ada:Started,Bob:Queued");

    await OrganizationMessagesServiceTests.service(host, sender).reconcileAsync();
    await OrganizationMessagesServiceTests.service(host, sender).reconcileAsync();
    const [message] = await host.organizationMessages.listAsync();

    Assert.areEqual(`Ada:Started:null,Bob:Failed:${Resources.organizationSendInterrupted}`,
      message?.recipients.map(t => `${t.teammateName}:${t.state}:${t.reason}`).join());
  }

  @TestMethod
  public async marksARecipientRemovedWhenItsTeammateIsGoneAndFailedWithTheReasonWhenItsSendFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const bob = await OrganizationMessagesServiceTests.teammateAsync(host, "Bob");
    const carol = await OrganizationMessagesServiceTests.teammateAsync(host, "Carol");
    const sender = await OrganizationMessagesServiceTests.senderAsync(host, [ada, bob, carol]);
    sender.failures.set(ada.id, new ServiceException(ErrorCode.NotFound, "Gone", [ada.id]));
    sender.failures.set(bob.id, "Signed out");
    sender.failures.set(carol.id, new Error("Boom"));

    const sent = await OrganizationMessagesServiceTests.service(host, sender).sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Hi"));

    Assert.areEqual("Removed:null,Failed:Signed out,Failed:Boom", sent.recipients.map(t => `${t.state}:${t.reason}`).join());
    Assert.isTrue(sent.recipients.every(t => Object.isNull(t.chatId) && Object.isNull(t.messageId)));
  }

  @TestMethod
  public async listsTheRepliesToEachRecipientsMessageInItsChatAndNoneForARecipientItNeverReachedOrAnUnknownMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationMessagesServiceTests.teammateAsync(host, "Ada");
    const out = await host.createProviderAsync("fake", "Spare");
    await host.teammates.createAsync(new TeammateCreateParams("Bob", null, out.id, Harness.Provider, null, null));
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(out.id));
    const send = async (target: OrganizationTarget, text: string, answer: string): Promise<OrganizationMessage> => {
      host.adapter.detailTexts = [answer];
      const sent = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(target, text));
      await host.engine.waitForIdle();
      return sent;
    };
    const first = await send(OrganizationTarget.everyone, "Status?", "Ada here.");
    const second = await send(OrganizationTarget.teammate(ada.id), "Again?", "Still here.");
    const said = async (message: OrganizationMessage): Promise<string> => (await host.organizationMessages.listRepliesAsync(new MessageIdParams(message.id)))
      .map(t => `${t.teammateName}:${t.status}:${t.details.filter(u => u.kind === DetailKind.Text).map(u => u.text).join(" ")}`).join("|");

    Assert.areEqual("Ada:Started,Bob:Failed", OrganizationMessagesServiceTests.states(first));
    Assert.areEqual(first.recipients[0]?.chatId, second.recipients[0]?.chatId);
    Assert.areEqual(`Ada:${MessageStatus.Completed}:Ada here.`, await said(first));
    Assert.areEqual(`Ada:${MessageStatus.Completed}:Still here.`, await said(second));
    const unknown = await Assert.throwsAsync(() => host.organizationMessages.listRepliesAsync(new MessageIdParams("missing")), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, unknown.info.name);
  }

  private static service(host: CoreHost, sender: FakeOrganizationSender): OrganizationMessagesService {
    return new OrganizationMessagesService(host.context, host.organization, host.teammates, host.messages, sender, host.events);
  }

  private static async senderAsync(host: CoreHost, teammates: readonly Teammate[]): Promise<FakeOrganizationSender> {
    const chatIds: Record<string, string> = {};
    for (const teammate of teammates)
      chatIds[teammate.id] = (await host.createConversationAsync(undefined, teammate.name)).id;
    return new FakeOrganizationSender(host.messages, chatIds);
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    const provider = await host.providerOfAsync();
    return await host.teammates.createAsync(new TeammateCreateParams(name, null, provider.id, Harness.Provider, null, null));
  }

  private static async departmentAsync(host: CoreHost, name: string, parentId: string | null, members: readonly Teammate[],
    leader: Teammate | null): Promise<Department> {
    const department = await host.organization.createAsync(new DepartmentCreateParams(name, parentId));
    for (const member of members)
      await host.organization.setMemberAsync(new DepartmentMemberSetParams(member.id, department.id));
    if (!Object.isNull(leader))
      await host.organization.updateAsync(new DepartmentUpdateParams(department.id, undefined, leader.id));
    return department;
  }

  private static states(message: OrganizationMessage): string {
    return message.recipients.map(t => `${t.teammateName}:${t.state}`).join();
  }

  private static async feedAsync(host: CoreHost): Promise<string> {
    return (await host.context.database.changeFeed.readAfterAsync(0)).filter(t => t.entity === ChangeEntity.OrganizationMessage).map(t => t.operation).join(",");
  }

  private static async failsAsync(action: () => Promise<unknown>): Promise<void> {
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(action, ServiceException)).info.name);
  }
}
