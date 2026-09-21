/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";

import { TurnRequest } from "@noldova/teamrun-core";
import { MessageAttachment, RequestedSettings } from "@noldova/teamrun-protocol";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ClaudePrompt } from "@noldova/teamrun-providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ClaudePromptTests {
  @TestMethod
  public async includesAllNativeImageTypesAndLeavesOtherFilesToTheTextReferences(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("image");
    writeFileSync(path, Buffer.from([0, 1, 2, 255]));
    const attachments = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]
      .map(t => new MessageAttachment("file", t, 4, path));
    const prompt = new ClaudePrompt(new TurnRequest(null, directory.path, "Read files", new RequestedSettings("claude", null, null), null, attachments));
    const messages = [];
    for await (const message of prompt)
      messages.push(message);
    Assert.areEqual(1, messages.length);
    Assert.areEqual(JSON.stringify({
      type: "user", message: { role: "user", content: [
        { type: "text", text: "Read files" },
        ...attachments.slice(0, 4).map(t => ({ type: "image", source: { type: "base64", media_type: t.mediaType, data: "AAEC/w==" } }))
      ] }, parent_tool_use_id: null
    }), JSON.stringify(messages[0]));
  }
}
