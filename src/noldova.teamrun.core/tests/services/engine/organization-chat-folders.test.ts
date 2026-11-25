/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatFolders, Resources } from "@noldova/teamrun.core";
import {
  ChatFolderAttachParams, Conversation, DepartmentCreateParams, DetailKind, Harness, Message, MessageAuthor, MessageDetail, MessageSendParams, MessageStatus, MethodName, OrganizationParent, OrganizationChat, OrganizationCreateParams, OrganizationIdParams, OrganizationUpdateParams,
  Request, type Teammate, TeammateCreateParams, TeammatePlaceParams, WrittenImageReader, WrittenImageReadParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class OrganizationChatFoldersTests {
  @TestMethod
  public async runsAnOrganizationChatWithNoFolderOfItsOwnInItsOrganizationsFolderInsideItsCurrentDefaultFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const first = OrganizationChatFoldersTests.folder(host, "first");
    const second = OrganizationChatFoldersTests.folder(host, "second");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", first));
    await host.organization.placeAsync(new TeammatePlaceParams(studio.id, ada.id, OrganizationParent.person, 0));
    const chat = new OrganizationChat(studio.id, ada.id);
    const own = await host.engine.openOrganizationChatAsync(chat);

    await OrganizationChatFoldersTests.sendAsync(host, chat, "One");
    await host.organization.updateOrganizationAsync(new OrganizationUpdateParams(studio.id, "Studio", second));
    await OrganizationChatFoldersTests.sendAsync(host, chat, "Two");
    await host.organization.updateOrganizationAsync(new OrganizationUpdateParams(studio.id, "Studio", null));
    await OrganizationChatFoldersTests.sendAsync(host, chat, "Three");

    Assert.areEqual(`${join(first, ".teamrun", studio.id)},${join(second, ".teamrun", studio.id)},${own.folder}`,
      host.adapter.requests.map(t => t.workingDirectory).join(","));
    Assert.isTrue(host.adapter.requests[0]?.prompt.includes(Resources.organizationNoDepartment) ?? false);
  }

  @TestMethod
  public async runsTwoOrganizationsChatsWithOneDefaultFolderInSeparateFoldersInsideIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const shared = OrganizationChatFoldersTests.folder(host, "shared");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", shared));
    const lab = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Lab", shared));

    await OrganizationChatFoldersTests.sendAsync(host, new OrganizationChat(studio.id, ada.id), "One");
    await OrganizationChatFoldersTests.sendAsync(host, new OrganizationChat(lab.id, ada.id), "Two");
    const folders = [studio, lab].map(t => ChatFolders.organizationPathOf(shared, t.id));

    Assert.areEqual(folders.join(","), host.adapter.requests.map(t => t.workingDirectory).join(","));
    Assert.areNotEqual(folders[0], folders[1]);
    Assert.isTrue(folders.every(t => existsSync(t)));
  }

  @TestMethod
  public async readsAnImageAReplyDrewInItsOrganizationsChatFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const studioFolder = OrganizationChatFoldersTests.folder(host, "studio");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", studioFolder));
    const opened = await host.engine.openOrganizationChatAsync(new OrganizationChat(studio.id, ada.id));
    const chatFolder = ChatFolders.prepareOrganization(studioFolder, studio.id);
    const out = join(chatFolder, "out");
    mkdirSync(out, { recursive: true });
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000300", "hex"), Buffer.alloc(4)]);
    writeFileSync(join(out, "chart.png"), png);
    await host.messages.insertAsync(new Message("reply", opened.id, 0, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Drew ![chart](out/chart.png).", null, "t")], null, "t", null, "t"));

    const path = new WrittenImageReader().markdownImagePathOf("out/chart.png", chatFolder);
    Assert.isNotNull(path);
    const read = await host.engine.readWrittenImageAsync(new WrittenImageReadParams(opened.id, "reply", path));

    Assert.areEqual("chart.png", read.name);
    Assert.areEqual(png.length, read.size);
  }

  @TestMethod
  public async keepsAnOrganizationChatsOwnFolderOverItsOrganizations(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", OrganizationChatFoldersTests.folder(host, "studio")));
    const chat = new OrganizationChat(studio.id, ada.id);
    const opened = await host.engine.openOrganizationChatAsync(chat);
    const own = OrganizationChatFoldersTests.folder(host, "own");
    const attached = await host.dispatcher.dispatch(new Request("r", MethodName.ChatFolderAttach, new ChatFolderAttachParams(opened.id, own).toJson()));

    await OrganizationChatFoldersTests.sendAsync(host, chat, "Here");

    Assert.isFalse(attached.hasErrors);
    Assert.areEqual(own, Conversation.fromJson(attached.payload).attachedFolder);
    Assert.areEqual(own, host.adapter.requests[0]?.workingDirectory);
  }

  @TestMethod
  public async runsAChatOfADeletedOrganizationInItsOwnFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", OrganizationChatFoldersTests.folder(host, "studio")));
    const chat = new OrganizationChat(studio.id, ada.id);
    const opened = await host.engine.openOrganizationChatAsync(chat);
    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(studio.id));

    await host.engine.sendAsync(new MessageSendParams(opened.id, "Still here", null, null, [], [], ada.id));
    await host.engine.waitForIdle();

    Assert.areEqual(opened.folder, host.adapter.requests[0]?.workingDirectory);
    Assert.isFalse(host.adapter.requests[0]?.prompt.includes(Resources.organizationNoDepartment) ?? true);
  }

  @TestMethod
  public async tellsATeammateItsPlaceInTheOrganizationItsChatBelongsTo(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const type = await host.typeAsync();
    const ada = await OrganizationChatFoldersTests.teammateAsync(host);
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    const studioType = await host.typeAsync(studio.id);
    await host.organization.createAsync(new DepartmentCreateParams(Resources.defaultOrganizationId, "Design", type, OrganizationParent.person, ada.id));
    await host.organization.createAsync(new DepartmentCreateParams(studio.id, "Art", studioType, OrganizationParent.person, ada.id));

    await OrganizationChatFoldersTests.sendAsync(host, new OrganizationChat(studio.id, ada.id), "Status?");
    await OrganizationChatFoldersTests.sendAsync(host, new OrganizationChat(Resources.defaultOrganizationId, ada.id), "Status?");

    Assert.isTrue(host.adapter.requests[0]?.prompt.includes(Resources.formatOrganizationRolePrompt(Resources.formatOrganizationRole(Resources.formatOrganizationLeader("Art"),
      Resources.organizationReportsToPerson, []), "Status?")) ?? false);
    Assert.isTrue(host.adapter.requests[1]?.prompt.includes(Resources.formatOrganizationRolePrompt(Resources.formatOrganizationRole(Resources.formatOrganizationLeader("Design"),
      Resources.organizationReportsToPerson, []), "Status?")) ?? false);
  }

  private static async teammateAsync(host: CoreHost): Promise<Teammate> {
    return await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
  }

  private static async sendAsync(host: CoreHost, chat: OrganizationChat, text: string): Promise<void> {
    const opened = await host.engine.openOrganizationChatAsync(chat);
    await host.engine.sendAsync(new MessageSendParams(opened.id, text, null, null, [], [], chat.teammateId));
    await host.engine.waitForIdle();
  }

  private static folder(host: CoreHost, name: string): string {
    const path = join(host.directory.path, name);
    mkdirSync(path, { recursive: true });
    return path;
  }
}
