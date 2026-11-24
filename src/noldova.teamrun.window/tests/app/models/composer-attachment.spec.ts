/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorCode, MessageAttachment } from "@noldova/teamrun.protocol";

import { FileShare } from "../../../src/app/models/file-share";
import { PickedAttachment } from "../../../src/app/models/picked-attachment";
import { SavedAttachment } from "../../../src/app/models/saved-attachment";
import { ViewedImage } from "../../../src/app/models/viewed-image";
import { CodedError } from "../../fixtures/coded-error.fixture";

describe("ComposerAttachment", () => {
  const address = "desktop-file://0123456789abcdef0123456789abcdef/";
  const discard = vi.fn();
  const read = vi.fn((_path: string) => Promise.resolve(new FileShare(address, discard)));

  afterEach(() => {
    vi.unstubAllGlobals();
    read.mockClear();
    discard.mockClear();
  });

  it("gives each attachment its own key, even two of one file or one saved file", () => {
    const file = new File(["image"], "picture.png", { type: "image/png" });
    const saved = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");
    const keys = [new PickedAttachment(file), new PickedAttachment(file), new SavedAttachment(saved), new SavedAttachment(saved)].map(t => t.key);

    expect(new Set(keys).size).toBe(4);
  });

  it("views a picked image from its bytes and a saved one from its stored path, and a file with no preview as no image", async () => {
    const picked = new PickedAttachment(new File(["image"], "picture.png", { type: "image/png" }));
    const saved = new MessageAttachment("photo.png", "image/png", 5, "D:/data/attachments/drafts/c1/photo.png");
    const stored = new SavedAttachment(saved);
    const text = new PickedAttachment(new File(["notes"], "notes.txt", { type: "text/plain" }));
    await Promise.all([picked.loadPreview(read), stored.loadPreview(read), text.loadPreview(read)]);

    expect([picked.viewedImageIn("c1"), stored.viewedImageIn("c1"), text.viewedImageIn("c1")]).toEqual([
      ViewedImage.fromData(picked.key, "c1", "picture.png", "image/png", "aW1hZ2U="),
      new ViewedImage(stored.key, "c1", "photo.png", "image/png", saved.path, null),
      null
    ]);
  });

  it("shows no preview of an image that can't be read back", async () => {
    const saved = new SavedAttachment(new MessageAttachment("gone.png", "image/png", 5, "D:/data/attachments/drafts/c1/gone.png"));
    await saved.loadPreview(() => Promise.reject(new CodedError("The attachment is gone.", ErrorCode.NotFound)));
    expect(saved.previewUrl()).toBeNull();

    vi.stubGlobal("FileReader", class {
      public error: DOMException = new DOMException("The file could not be read.", "NotReadableError");
      public onerror: (() => void) | null = null;

      public readAsDataURL(): void {
        queueMicrotask(() => this.onerror?.());
      }
    });
    const picked = new PickedAttachment(new File(["image"], "picture.png", { type: "image/png" }));
    await picked.loadPreview(read);
    expect(picked.previewUrl()).toBeNull();
  });

  it("lets a failure other than the read's surface from the preview", async () => {
    const saved = new SavedAttachment(new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png"));
    const failure = new Error("The answer is malformed.");

    await expect(saved.loadPreview(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(saved.loadPreview(() => Promise.reject(new Error("No code.")))).rejects.toThrow("No code.");
    await expect(saved.loadPreview(() => Promise.reject("offline"))).rejects.toBe("offline");
    expect(saved.previewUrl()).toBeNull();
  });
});
