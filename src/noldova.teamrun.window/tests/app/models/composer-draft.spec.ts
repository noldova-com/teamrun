/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AttachmentInput, MessageAttachment } from "@noldova/teamrun.protocol";

import { ComposerDraft } from "../../../src/app/models/composer-draft";
import { SavedAttachment } from "../../../src/app/models/saved-attachment";

describe("ComposerDraft", () => {
  const saved = new SavedAttachment(new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/notes.txt"));

  it("is empty while it holds only blank text and no files", () => {
    expect(new ComposerDraft("c1", " \n\t", []).isEmpty).toBe(true);
    expect(new ComposerDraft("c1", "hi", []).isEmpty).toBe(false);
    expect(new ComposerDraft("c1", "", [saved]).isEmpty).toBe(false);
  });

  it("keeps its own copy of the files it was given", () => {
    const attachments = [saved];
    const draft = new ComposerDraft("c1", "", attachments);

    attachments.pop();

    expect(draft.attachments).toEqual([saved]);
  });

  it("becomes the save parameters of its conversation, text, files and the revision it replaces, taking each file's input after the one before", async () => {
    const other = new SavedAttachment(new MessageAttachment("other.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/other.txt"));
    const asked: string[] = [];
    let open = 0;

    const params = await new ComposerDraft("c1", "hello", [saved, other]).toParams(async attachment => {
      expect(open).toBe(0);
      open++;
      asked.push(attachment.name);
      await Promise.resolve();
      open--;
      return new AttachmentInput(attachment.name, attachment.mediaType, null, `D:/prepared/${attachment.name}`);
    }, 4);

    expect(asked).toEqual(["notes.txt", "other.txt"]);
    expect(params.conversationId).toBe("c1");
    expect(params.text).toBe("hello");
    expect(params.revision).toBe(4);
    expect(params.attachments.map(t => t.path)).toEqual(["D:/prepared/notes.txt", "D:/prepared/other.txt"]);
  });
});
