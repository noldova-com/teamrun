/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";

import { TurnRequest } from "@noldova/teamrun.core";
import { MessageAttachment, RequestedSettings } from "@noldova/teamrun.protocol";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudePrompt } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ClaudePromptTests {
  @TestMethod
  public includesAllNativeImageTypesAndLeavesOtherFilesToTheTextReferences(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("image");
    writeFileSync(path, Buffer.from([0, 1, 2, 255]));
    const attachments = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]
      .map(t => new MessageAttachment("file", t, 4, path));
    const request = new TurnRequest(null, directory.path, "Read files", new RequestedSettings("claude", null, null), null, attachments);
    const message = ClaudePrompt.create(request, "Read files", "11111111-1111-1111-1111-111111111111");
    Assert.areEqual(JSON.stringify({
      type: "user", message: { role: "user", content: [
        { type: "text", text: "Read files" },
        ...attachments.slice(0, 4).map(t => ({ type: "image", source: { type: "base64", media_type: t.mediaType, data: "AAEC/w==" } }))
      ] }, parent_tool_use_id: null, uuid: "11111111-1111-1111-1111-111111111111"
    }), JSON.stringify(message));
  }

  @TestMethod
  public sendsATextOnlyPromptAsPlainContentSoASlashCommandStaysACommand(): void {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("notes.pdf"), "pdf");
    const attachments = [new MessageAttachment("notes.pdf", "application/pdf", 3, directory.resolve("notes.pdf"))];
    const request = new TurnRequest(null, directory.path, "/compact", new RequestedSettings("claude", null, null), null, attachments);

    const message = ClaudePrompt.create(request, "/compact", "22222222-2222-2222-2222-222222222222");

    Assert.areEqual(JSON.stringify({ type: "user", message: { role: "user", content: "/compact" }, parent_tool_use_id: null, uuid: "22222222-2222-2222-2222-222222222222" }),
      JSON.stringify(message));
  }
}
