/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationCreateParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class NewChatCommandTests {
  @TestMethod
  public async startsAChatWithTheGivenTitleOrTheDefaultOne(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCreate", () => SampleData.release.toJson());

    const result = await context.runAsync("teamrun.newChat", { projectId: "p1", title: "Release" });
    await context.runAsync("teamrun.newChat", { projectId: "p1" });

    Assert.areEqual("Started chat c1: Release", result.text);
    Assert.areEqual(JSON.stringify(SampleData.release.toJson()), JSON.stringify(result.value));
    const [titled, untitled] = context.payloadsOf("teamrun.conversationCreate").map(t => ConversationCreateParams.fromJson(t));
    Assert.areEqual("p1 Release", `${titled!.projectId} ${titled!.title}`);
    Assert.isNull(untitled!.title);
  }

  @TestMethod
  public async startsAChatWithoutAProjectWhenNoneIsGiven(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCreate", () => SampleData.release.toJson());

    await context.runAsync("teamrun.newChat", { title: "Scratch" });

    const [created] = context.payloadsOf("teamrun.conversationCreate").map(t => ConversationCreateParams.fromJson(t));
    Assert.areEqual("null Scratch", `${String(created!.projectId)} ${created!.title}`);
  }
}
