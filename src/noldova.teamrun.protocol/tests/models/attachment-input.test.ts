/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentInput, MessageSendParams, RequestedSettings } from "@noldova/teamrun.protocol";

@TestClass
export class AttachmentInputTests {
  @TestMethod
  public roundTripsUploadsReferencesAndFileOnlySends(): void {
    for (const input of [new AttachmentInput("empty.txt", "text/plain", "", null), new AttachmentInput("saved.txt", "text/plain", null, "/saved.txt"),
      new AttachmentInput("chosen.zip", "application/zip", null, null, "g1")]) {
      const decoded = AttachmentInput.fromJson(input.toJson());
      Assert.areEqual(JSON.stringify(input.toJson()), JSON.stringify(decoded.toJson()));
      const params = new MessageSendParams("conversation", "", new RequestedSettings("codex", null, null), null, [input]);
      Assert.areEqual(1, MessageSendParams.fromJson(params.toJson()).attachments.length);
    }
    Assert.isNull(AttachmentInput.fromJson({ name: "a.txt", mediaType: "text/plain", data: "", path: null }).grant);
    Assert.areEqual("name,mediaType,data,path", Object.keys(new AttachmentInput("a.txt", "text/plain", "", null).toJson()).join(","));
    Assert.areEqual("g1", new AttachmentInput("a.zip", "application/zip", null, null, "g1").toJson()["grant"]);
  }

  @TestMethod
  public rejectsAmbiguousSourcesAndBlankNames(): void {
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, null), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", "", "/a"), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, " "), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", "", null, "g1"), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, "/a", "g1"), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "text/plain", null, null, " "), ArgumentException);
    Assert.throws(() => new AttachmentInput("", "text/plain", "", null), ArgumentException);
    Assert.throws(() => new AttachmentInput("a", "", "", null), ArgumentException);
  }
}
