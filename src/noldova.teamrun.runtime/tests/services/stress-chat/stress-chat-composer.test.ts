/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FileChangeReader, type Message, MessageAttachment, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";
import { StressChatComposer } from "@noldova/teamrun.runtime/development";

@TestClass
export class StressChatComposerTests {
  private static readonly ROOT: string = join("data", "stress-chat");
  private static readonly END: Date = new Date("2026-10-19T12:00:00.000Z");
  private static readonly ATTACHMENTS: readonly MessageAttachment[] = [
    new MessageAttachment("opaque.png", "image/png", 2048, "attachments/opaque.png", 1280, 720),
    new MessageAttachment("4k.png", "image/png", 4096, "attachments/4k.png", 3840, 2160)
  ];

  @TestMethod
  public composesFinishedPairsFromTheScenariosInOrderTwoMinutesApart(): void {
    const messages = [...new StressChatComposer("chat", StressChatComposerTests.ROOT, StressChatComposerTests.ATTACHMENTS).compose(50, StressChatComposerTests.END)];
    const requests = messages.filter(t => t.author === MessageAuthor.User);
    const replies = messages.filter(t => t.author === MessageAuthor.Provider);

    Assert.areEqual(100, messages.length);
    Assert.areEqual(Array.from({ length: 100 }, (_, index) => index).join(","), messages.map(t => t.sequence).join(","));
    Assert.isTrue(messages.every((t, index) => t.conversationId === "chat" && t.author === (index % 2 === 0 ? MessageAuthor.User : MessageAuthor.Provider)));
    Assert.isTrue(replies.every((t, index) => t.inReplyTo === requests[index]?.id));
    Assert.areEqual(100, new Set(messages.map(t => t.id)).size);
    Assert.areEqual(messages.map(t => t.id).join(","), messages.map(t => t.id).sort().join(","));
    Assert.isTrue(requests[0]?.details[0]?.text.startsWith("**TURN-00001** · Short reply\n\n## 100 messages\n\nThis chat holds **50 pairs**") ?? false);
    Assert.areEqual("**TURN-00002** · Long prose\n\nShow the long prose example. This is synthetic test data.", requests[1]?.details[0]?.text);
    Assert.areEqual("**TURN-00023** · Mentions\n\n@Atlas and @Nova, look at this request together. This is synthetic test data.", requests[22]?.details[0]?.text);
    Assert.areEqual("13,38", StressChatComposerTests.indexesWhere(requests, t => t.attachments.length > 0));
    Assert.areEqual("opaque.png,4k.png", requests[38]?.attachments.map(t => t.name).join(","));
    Assert.areEqual("22,47", StressChatComposerTests.indexesWhere(requests, t => t.mentions.length > 0));
    Assert.areEqual("stress-chat-atlas Atlas,stress-chat-nova Nova", requests[47]?.mentions.map(t => `${t.teammateId} ${t.name}`).join(","));
    Assert.isTrue(requests.every(t => t.status === MessageStatus.Completed && t.provenance === null && t.startedAt === null && t.endedAt === t.createdAt));
    Assert.isTrue(replies.every(t => t.attachments.length === 0 && t.mentions.length === 0 && t.teammateId === null && t.teammateName === null));
    Assert.areEqual("20,45", StressChatComposerTests.indexesWhere(replies, t => t.status === MessageStatus.Failed));
    Assert.areEqual("21,46", StressChatComposerTests.indexesWhere(replies, t => t.status === MessageStatus.Cancelled));
    Assert.isTrue(replies.every(t => t.provenance?.providerId === null && t.provenance.nativeSessionId === null
      && t.provenance.requested.kind === "Synthetic" && t.provenance.requested.model === "stress-chat" && t.provenance.observed.kind === "Synthetic"));
    Assert.areEqual("2026-10-19T10:20:00.000Z", requests[0]?.createdAt);
    Assert.areEqual("2026-10-19T10:20:01.000Z 2026-10-19T10:20:04.000Z", `${replies[0]?.startedAt} ${replies[0]?.endedAt}`);
    Assert.areEqual("2026-10-19T11:58:00.000Z", requests[49]?.createdAt);
    Assert.areEqual("2026-10-19T11:58:01.000Z 2026-10-19T11:59:36.000Z", `${replies[49]?.startedAt} ${replies[49]?.endedAt}`);
    Assert.isTrue(replies.every(t => t.details[0]?.createdAt === t.startedAt && t.details.at(-1)?.createdAt === t.endedAt
      && t.details.every((detail, index) => detail.sequence === index && (index === 0 || detail.createdAt > (t.details[index - 1]?.createdAt ?? "")))));
  }

  @TestMethod
  public writesFileChangesTheChangesPanelReads(): void {
    const replies = [...new StressChatComposer("chat", StressChatComposerTests.ROOT, []).compose(25, StressChatComposerTests.END)]
      .filter(t => t.author === MessageAuthor.Provider);
    const reader = new FileChangeReader();
    const editsOf = (reply: Message | undefined): string => reader.editsIn(reply?.details ?? []).map(t => `${t.path} ${t.kind} ${t.lines.length}`).join(",");
    const images = join(StressChatComposerTests.ROOT, "images");
    const sources = join(StressChatComposerTests.ROOT, "src");

    Assert.areEqual(`${join(images, "opaque.png")} add 0,${join(images, "transparent.png")} add 0,${join(images, "wide.png")} add 0,${join(images, "4k.png")} add 0`,
      editsOf(replies[14]));
    Assert.areEqual(`${join(sources, "example.ts")} update 8,${join(sources, "added.ts")} add 2,${join(sources, "removed.ts")} delete 1,`
      + `${join(sources, "extra-1.ts")} add 1,${join(sources, "extra-2.ts")} add 1,${join(sources, "extra-3.ts")} add 1`, editsOf(replies[17]));
    Assert.areEqual(`${join(sources, "example.ts")} update 6,${join(sources, "added.ts")} add 3`, editsOf(replies[18]));
    Assert.areEqual(`${join(sources, "renamed.ts")} move 0,${join(sources, "example.ts")} update 9`, editsOf(replies[19]));
  }

  @TestMethod
  public endsARunThatIsNotAWholeNumberOfRoundsPartWayThroughTheScenarios(): void {
    const messages = [...new StressChatComposer("chat", StressChatComposerTests.ROOT, []).compose(27, StressChatComposerTests.END)];
    const replies = messages.filter(t => t.author === MessageAuthor.Provider);

    Assert.areEqual(54, messages.length);
    Assert.areEqual("**Short reply** **Long prose**", `${replies[25]?.details[0]?.text} ${replies[26]?.details[0]?.text}`);
    Assert.areEqual("**TURN-00027** · Long prose", messages[52]?.details[0]?.text.split("\n")[0]);
    Assert.areEqual("2026-10-19T11:06:00.000Z", messages[0]?.createdAt);
  }

  private static indexesWhere(messages: readonly Message[], predicate: (message: Message) => boolean): string {
    return messages.flatMap((t, index) => predicate(t) ? [index] : []).join(",");
  }
}
