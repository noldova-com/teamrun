/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join } from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  AttachmentInput, ConversationIdParams, ConversationRewindParams, DraftSaveParams, type MessageSendResult, MessageSendParams, ProjectIdParams, RequestedSettings
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class SentFilesTests {
  @TestMethod
  @TestData(false)
  @TestData(true)
  public async removesTheSentFilesOfADeletedChatOrAForgottenProjectsChatsAndKeepsAnotherChats(forgets: boolean): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const chat = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const sent = SentFilesTests.pathOf(await SentFilesTests.sendAsync(host, chat.id, "a.txt"));
    const kept = SentFilesTests.pathOf(await SentFilesTests.sendAsync(host, other.id, "b.txt"));

    if (forgets)
      await host.projects.forgetAsync(new ProjectIdParams(project.id));
    else
      await host.conversations.deleteAsync(new ConversationIdParams(chat.id));

    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify([existsSync(sent), existsSync(kept)]));
  }

  @TestMethod
  public async removesTheSentFilesOfTheMessagesARewindRemovesButTheRewoundMessagesOwnWhichItsDraftTakes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const first = await SentFilesTests.sendAsync(host, chat.id, "a.txt");
    const second = await SentFilesTests.sendAsync(host, chat.id, "b.txt");
    const third = await SentFilesTests.sendAsync(host, chat.id, "c.txt");

    await host.engine.rewindAsync(new ConversationRewindParams(chat.id, second.sent.id, false));

    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify([first, second, third].map(t => existsSync(SentFilesTests.pathOf(t)))));
  }

  @TestMethod
  public async sweepsTheSentFilesNoMessageNamesAndKeepsTheOthersAndTheDraftsFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const sent = SentFilesTests.pathOf(await SentFilesTests.sendAsync(host, chat.id, "a.txt"));
    const draft = await host.drafts.saveAsync(new DraftSaveParams(chat.id, "Later", [SentFilesTests.upload("b.txt")]));
    const stray = join(dirname(sent), "stray.txt");
    writeFileSync(stray, "left by a crash");

    await host.drafts.sweepAsync();

    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify([sent, draft.attachments[0]?.path ?? "", stray].map(t => existsSync(t))));
  }

  @TestMethod
  public async logsASentFileRemovalThatFailsOnADeleteARewindOrTheSweep(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const deleted = await host.createConversationAsync();
    const rewound = await host.createConversationAsync();
    const sent = SentFilesTests.pathOf(await SentFilesTests.sendAsync(host, deleted.id, "a.txt"));
    const target = await SentFilesTests.sendAsync(host, rewound.id, "b.txt");
    const later = SentFilesTests.pathOf(await SentFilesTests.sendAsync(host, rewound.id, "c.txt"));
    const original = fs.rmSync;
    try {
      fs.rmSync = () => { throw Object.assign(new Error("Simulated busy file"), { code: "EBUSY" }); };
      syncBuiltinESMExports();
      await host.conversations.deleteAsync(new ConversationIdParams(deleted.id));
      await host.engine.rewindAsync(new ConversationRewindParams(rewound.id, target.sent.id, false));
      await host.drafts.sweepAsync();
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual([
      `The sent files of the chat ending in "${deleted.id.slice(-12)}" were not removed: EBUSY.`,
      `The sent files of the chat ending in "${rewound.id.slice(-12)}" were not removed: EBUSY.`,
      "The sent files no message names were not removed: EBUSY."
    ].join("\n"), host.log.lines.join("\n"));
    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify([existsSync(sent), existsSync(later)]));
  }

  private static async sendAsync(host: CoreHost, chatId: string, name: string): Promise<MessageSendResult> {
    const sent = await host.engine.sendAsync(new MessageSendParams(chatId, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id,
      [SentFilesTests.upload(name)]));
    await host.engine.waitForIdle();
    return sent;
  }

  private static pathOf(sent: MessageSendResult): string {
    const [attachment] = sent.sent.attachments;
    Assert.isDefined(attachment);
    return attachment.path;
  }

  private static upload(name: string): AttachmentInput {
    return new AttachmentInput(name, "text/plain", Buffer.from(name).toString("base64"), null);
  }
}
