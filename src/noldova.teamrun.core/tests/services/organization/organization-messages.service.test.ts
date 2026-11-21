/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChangeEntity, OrganizationMessagesService, Resources } from "@noldova/teamrun.core";
import {
  type Department, DepartmentCreateParams, DepartmentMemberSetParams, DepartmentUpdateParams, ErrorCode, EventName, Harness, MessageAuthor, MessageIdParams,
  MessageListParams, MessageStatus, type OrganizationMessage, OrganizationMessageSendParams, OrganizationTarget, ProviderEnabledParams, type Teammate,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeOrganizationSender } from "../../fixtures/fake-organization-sender.fixture.js";

@TestClass
export class OrganizationMessagesServiceTests {
  @TestMethod
  public async sendsADepartmentMessageToItsLeaderThenItsDirectMembersThroughTheEngineAndStoresEachStarted(): Promise<void> {
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
    Assert.areEqual(`${MessageAuthor.User} ${Resources.organizationMessageLabel} ${sent.recipients[0]?.chatId}`,
      `${first?.author} ${first?.sender?.name} ${first?.chatId}`);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual(JSON.stringify([sent.toJson()]), JSON.stringify((await host.organizationMessages.listAsync()).map(t => t.toJson())));
    Assert.areEqual("Insert,Update,Update", await OrganizationMessagesServiceTests.feedAsync(host));
    Assert.areEqual(updated + 3, host.listener.count(EventName.OrganizationMessageUpdated));
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
    Assert.areEqual(`${bob.id}:${Resources.organizationMessageLabel}:One`, sender.sends[0]);
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
    const off = await host.createProviderAsync("fake", "Spare");
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, off.id, Harness.Provider, null, null));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.id, false));

    const sent = await host.organizationMessages.sendAsync(new OrganizationMessageSendParams(OrganizationTarget.everyone, "Status?"));
    await host.engine.waitForIdle();

    Assert.areEqual(`Ada:Started:null,Bob:Failed:${Resources.formatAccountCannotReply("Bob", "Spare")}`,
      sent.recipients.map(t => `${t.teammateName}:${t.state}:${t.reason}`).join());
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(ada.id, sent.recipients[0]?.teammateId);
    Assert.isNull(sent.recipients.find(t => t.teammateId === bob.id)?.chatId);
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
