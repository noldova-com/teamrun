/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AttachmentInput, MessageSendParams, RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class AttachmentInputTests {
  @TestMethod
  public roundTripsUploadsReferencesAndFileOnlySends(): void {
    for (const input of [new AttachmentInput("empty.txt", "text/plain", "", null), new AttachmentInput("saved.txt", "text/plain", null, "/saved.txt")]) {
      const decoded = AttachmentInput.fromJson(input.toJson());
      Assert.areEqual(JSON.stringify(input.toJson()), JSON.stringify(decoded.toJson()));
      const params = new MessageSendParams("conversation", "", new RequestedSettings("codex", null, null), null, [input]);
      Assert.areEqual(1, MessageSendParams.fromJson(params.toJson()).attachments.length);
    }
  }

  @TestMethod
  public rejectsAmbiguousSourcesAndBlankNames(): void {
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, null), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", "", "/a"), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, " "), ArgumentException);
    Assert.throws(() => new AttachmentInput("", "text/plain", "", null), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "", "", null), ArgumentException);
  }
}
