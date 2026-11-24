/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "@noldova/teamrun.core";
import {
  DepartmentCreateParams, DepartmentMemberSetParams, Harness, MessageSendParams, OrganizationChat, OrganizationCreateParams, OrganizationIdParams,
  OrganizationParent, type Teammate, TeammateCreateParams, TeammatePlaceParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class OrganizationChatOpeningTests {
  @TestMethod
  public async opensANewChatInAnOrganizationMadeAfterTheTeammatesEarlierOrganizationWasDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const copilot = await OrganizationChatOpeningTests.teammateAsync(host, "Copilot");
    const grok = await OrganizationChatOpeningTests.teammateAsync(host, "Grok");
    const devs = await host.organization.createAsync(new DepartmentCreateParams(Resources.defaultOrganizationId, "DEVS", await host.typeAsync(),
      OrganizationParent.person, copilot.id));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(Resources.defaultOrganizationId, grok.id, devs.id));
    const before = await OrganizationChatOpeningTests.sendAsync(host, new OrganizationChat(Resources.defaultOrganizationId, grok.id), "Status?");
    const noldova = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Noldova", null));
    await host.organization.deleteOrganizationAsync(new OrganizationIdParams(Resources.defaultOrganizationId));
    await host.organization.placeAsync(new TeammatePlaceParams(noldova.id, grok.id, OrganizationParent.person, 0));

    const after = await OrganizationChatOpeningTests.sendAsync(host, new OrganizationChat(noldova.id, grok.id), "Status?");
    const left = await host.conversations.findAsync(before);
    const opened = await host.conversations.findAsync(after);
    const [first, asked] = host.adapter.requests;
    Assert.isNotNull(left);
    Assert.isNotNull(opened);
    Assert.isDefined(first);
    Assert.isDefined(asked);
    const sent = [asked.prompt, asked.instructions, asked.freshPrompt, asked.instructionsWithoutTools].join(" ");

    Assert.areNotEqual(before, after);
    Assert.isNull(left.organizationChat);
    Assert.areEqual(noldova.id, opened.organizationChat?.organizationId);
    Assert.isTrue(asked.prompt.includes(Resources.formatOrganizationRole(Resources.organizationNoDepartment, Resources.organizationReportsToPerson, [])));
    Assert.isTrue(first.prompt.includes("DEVS"));
    Assert.isFalse(sent.includes("DEVS") || sent.includes("Copilot"));
    Assert.isNull(asked.resumeNativeSessionId);
  }

  @TestMethod
  public async keepsATeammatesOwnChatInEachOfTwoOrganizations(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const grok = await OrganizationChatOpeningTests.teammateAsync(host, "Grok");
    const studio = await host.organization.createOrganizationAsync(new OrganizationCreateParams("Studio", null));
    await host.organization.placeAsync(new TeammatePlaceParams(Resources.defaultOrganizationId, grok.id, OrganizationParent.person, 0));
    await host.organization.placeAsync(new TeammatePlaceParams(studio.id, grok.id, OrganizationParent.person, 0));

    const mine = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, grok.id));
    const studios = await host.engine.openOrganizationChatAsync(new OrganizationChat(studio.id, grok.id));
    const reopened = [await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, grok.id)),
      await host.engine.openOrganizationChatAsync(new OrganizationChat(studio.id, grok.id))];

    Assert.areNotEqual(mine.id, studios.id);
    Assert.areEqual(`${mine.id},${studios.id}`, reopened.map(t => t.id).join(","));
    Assert.areEqual(`${Resources.defaultOrganizationId},${studio.id}`, [mine, studios].map(t => t.organizationChat?.organizationId).join(","));
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    return await host.teammates.createAsync(new TeammateCreateParams(name, null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
  }

  private static async sendAsync(host: CoreHost, chat: OrganizationChat, text: string): Promise<string> {
    const opened = await host.engine.openOrganizationChatAsync(chat);
    await host.engine.sendAsync(new MessageSendParams(opened.id, text, null, null, [], [], chat.teammateId));
    await host.engine.waitForIdle();
    return opened.id;
  }
}
