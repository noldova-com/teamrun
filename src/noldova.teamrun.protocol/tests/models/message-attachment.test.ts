/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, Message, MessageAttachment, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class MessageAttachmentTests {
  @TestMethod
  public preservesMetadataAcrossMessageUpdatesAndStorage(): void {
    const image = new MessageAttachment("picture.png", "image/png", 10, "/picture.png");
    Assert.isTrue(image.isImage);
    Assert.isFalse(new MessageAttachment("data.csv", "text/csv", 0, "/data.csv").isImage);
    const provenance = new Provenance(null, new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null), null, false);
    const detail = new MessageDetail(0, DetailKind.Text, "text", null, "now");
    const message = new Message("message", "conversation", 0, MessageAuthor.Provider, null, MessageStatus.Completed, [], provenance, "now", "now", "now", [image]);
    for (const updated of [message, message.withStatus(MessageStatus.Completed, "later"), message.withDetails([detail]),
      message.withDetail(detail), message.withProvenance(provenance), Message.fromJson(message.toJson())])
      Assert.areEqual(JSON.stringify(image.toJson()), JSON.stringify(updated.attachments[0]?.toJson()));
    Assert.areEqual(JSON.stringify(image.toJson()), JSON.stringify(MessageAttachment.fromJson(image.toJson()).toJson()));
  }

  @TestMethod
  public keepsAnImagesPixelSizeAndReadsOlderRecordsWithoutOne(): void {
    const image = new MessageAttachment("picture.png", "image/png", 10, "/picture.png", 640, 480);
    const json = { name: "picture.png", mediaType: "image/png", size: 10, path: "/picture.png", width: 640, height: 480 };
    Assert.areEqual(JSON.stringify(json), JSON.stringify(image.toJson()));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(MessageAttachment.fromJson(json).toJson()));

    const older = MessageAttachment.fromJson({ name: "picture.png", mediaType: "image/png", size: 10, path: "/picture.png" });
    Assert.isNull(older.width);
    Assert.isNull(older.height);
    Assert.isNull(MessageAttachment.fromJson({ ...json, width: null, height: null }).width);
  }

  @TestMethod
  public rejectsAPixelSizeWithoutBothPositiveWholeNumbers(): void {
    for (const [width, height] of [[640, null], [null, 480], [0, 480], [640, -1], [1.5, 480], [640, Number.MAX_SAFE_INTEGER + 1]] as const)
      Assert.throws(() => new MessageAttachment("a.png", "image/png", 1, "/a.png", width, height), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidByteSizes(): void {
    for (const size of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      Assert.throws(() => new MessageAttachment("a", "text/plain", size, "/a"), ArgumentOutOfRangeException);
  }
}
