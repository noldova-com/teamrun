/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, OwnershipLock } from "@noldova/desktop.runtime";
import { MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";
import { RuntimePartException } from "@noldova/teamrun.runtime";
import { StressChatSeeder } from "@noldova/teamrun.runtime/development";

import { RecordingOutput } from "../../fixtures/recording-output.fixture.js";
import { SeededChat } from "../../fixtures/seeded-chat.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class StressChatSeederTests {
  @TestMethod
  public async writesThePairsInOrderThroughTeamRunsServicesAndARerunReplacesTheProject(): Promise<void> {
    using folder = new TemporaryDirectory();
    const directory = new DataDirectory(folder.path);
    const root = join(folder.path, "modules", "teamrun", "stress-chat");
    const attachments = join(folder.path, "modules", "teamrun", "attachments");

    const first = await new StressChatSeeder(directory, new RecordingOutput()).seedAsync(50);
    const chat = await SeededChat.readAsync(directory);
    const firstFiles = readdirSync(attachments).filter(t => t.endsWith(".png"));
    const second = await new StressChatSeeder(directory, new RecordingOutput()).seedAsync(26);
    const rerun = await SeededChat.readAsync(directory);
    const files = readdirSync(attachments).filter(t => t.endsWith(".png"));
    const requests = chat.messages.filter(t => t.author === MessageAuthor.User);
    const replies = chat.messages.filter(t => t.author === MessageAuthor.Provider);

    Assert.areEqual(root, first.rootPath);
    Assert.areEqual(first.id, chat.projects.map(t => t.id).join(","));
    Assert.areEqual("100 messages", chat.conversations.map(t => t.title).join(","));
    Assert.areEqual(Array.from({ length: 100 }, (_, index) => index).join(","), chat.messages.map(t => t.sequence).join(","));
    Assert.areEqual(50, requests.length);
    Assert.areEqual(
      Array.from({ length: 50 }, (_, index) => `TURN-${String(index + 1).padStart(5, "0")}`).join(","),
      requests.map(t => /TURN-\d{5}/u.exec(t.details[0]?.text ?? "")?.[0]).join(","));
    Assert.isTrue(chat.messages.every((t, index) => index % 2 === 0 || t.inReplyTo === chat.messages[index - 1]?.id));
    Assert.areEqual("**Short reply**", replies[0]?.details[0]?.text);
    Assert.areEqual("**Full showcase**", replies[24]?.details[0]?.text);
    Assert.areEqual("**Short reply**", replies[25]?.details[0]?.text);
    Assert.areEqual("**Full showcase**", replies[49]?.details[0]?.text);
    Assert.isTrue(replies.every(t => [MessageStatus.Completed, MessageStatus.Failed, MessageStatus.Cancelled].includes(t.status) && t.endedAt !== null));
    Assert.isTrue(replies.every(t => t.provenance?.providerId === null && t.provenance.nativeSessionId === null && t.teammateId === null));
    Assert.isTrue(requests[0]?.details[0]?.text.includes("No provider or provider session is attached") ?? false);
    Assert.areEqual(root, second.rootPath);
    Assert.areEqual(second.id, rerun.projects.map(t => t.id).join(","));
    Assert.areEqual("52 messages", rerun.conversations.map(t => t.title).join(","));
    Assert.areEqual(52, rerun.messages.length);
    Assert.areEqual(4, firstFiles.length);
    Assert.areEqual(4, files.length);
    Assert.isTrue(files.every(t => !firstFiles.includes(t)));
    Assert.isTrue(existsSync(join(root, "images", "4k.png")));
    Assert.isTrue(existsSync(join(root, "src", "example.ts")));
  }

  @TestMethod
  public async refusesAFolderTeamRunIsRunningOn(): Promise<void> {
    using folder = new TemporaryDirectory();
    const directory = new DataDirectory(folder.path);
    using lock = OwnershipLock.acquire(directory);

    const refusal = await new StressChatSeeder(directory, new RecordingOutput()).seedAsync(1).then(() => null, (t: unknown) => t);

    Assert.isInstanceOf(refusal, RuntimePartException);
    Assert.areEqual(`TeamRun is running on ${folder.path}; quit it and run the command again.`, (refusal as Error).message);
    Assert.isTrue(lock.isHeld);
    Assert.isFalse(existsSync(join(folder.path, "modules")));
  }
}
