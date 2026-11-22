/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorCode, MessageAttachment } from "@noldova/teamrun.protocol";

import { ComposerAttachment } from "../../../src/app/models/composer-attachment";
import { FileShare } from "../../../src/app/models/file-share";
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
    const keys = [new ComposerAttachment(file), new ComposerAttachment(file), new ComposerAttachment(saved), new ComposerAttachment(saved)].map(t => t.key);

    expect(new Set(keys).size).toBe(4);
  });

  it("sends a picked file by the grant issued for it, without its bytes, and names a file without a type as binary", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 255])], "data.bin");
    const attachment = new ComposerAttachment(file);
    const granted: File[] = [];

    const input = await attachment.toInput(t => {
      granted.push(t);
      return Promise.resolve("g1");
    });

    expect(input.name).toBe("data.bin");
    expect(input.mediaType).toBe("application/octet-stream");
    expect([input.grant, input.data, input.path]).toEqual(["g1", null, null]);
    expect(granted).toHaveLength(1);
    expect(granted[0]).toBe(file);
    expect(attachment.size).toBe(4);
    await attachment.loadPreview(read);
    expect(attachment.previewUrl()).toBeNull();
    attachment.dispose();
  });

  it("previews a picked image as a data URL of its bytes, and releases it when disposed", async () => {
    const attachment = new ComposerAttachment(new File(["image"], "picture.png", { type: "image/png" }));
    expect(attachment.previewUrl()).toBeNull();

    await attachment.loadPreview(read);

    expect(attachment.previewUrl()).toBe("data:image/png;base64,aW1hZ2U=");
    expect([attachment.mediaType, attachment.sharedPath]).toEqual(["image/png", null]);
    expect(read).not.toHaveBeenCalled();
    attachment.dispose();
    expect(attachment.previewUrl()).toBeNull();
  });

  it("previews a saved image by the address its stored path is shared at, and releases the share once when disposed", async () => {
    const saved = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");
    const attachment = new ComposerAttachment(saved);

    await attachment.loadPreview(read);

    expect(read).toHaveBeenCalledWith(saved.path);
    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([address, saved.path, 0]);
    attachment.dispose();
    attachment.dispose();
    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
  });

  it("releases a share that answers after the attachment is disposed, and shows nothing", async () => {
    const late = new ComposerAttachment(new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png"));
    const loading = late.loadPreview(read);
    late.dispose();
    await loading;

    expect([late.previewUrl(), late.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
  });

  it("drops a saved image's preview and releases its share when its address fails to load", async () => {
    const attachment = new ComposerAttachment(new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png"));
    await attachment.loadPreview(read);

    attachment.previewFailed();

    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
    attachment.dispose();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("shows no preview of an image that can't be read back", async () => {
    const saved = new ComposerAttachment(new MessageAttachment("gone.png", "image/png", 5, "D:/data/attachments/drafts/c1/gone.png"));
    await saved.loadPreview(() => Promise.reject(new CodedError("The attachment is gone.", ErrorCode.NotFound)));
    expect(saved.previewUrl()).toBeNull();

    vi.stubGlobal("FileReader", class {
      public error: DOMException = new DOMException("The file could not be read.", "NotReadableError");
      public onerror: (() => void) | null = null;

      public readAsDataURL(): void {
        queueMicrotask(() => this.onerror?.());
      }
    });
    const picked = new ComposerAttachment(new File(["image"], "picture.png", { type: "image/png" }));
    await picked.loadPreview(read);
    expect(picked.previewUrl()).toBeNull();
  });

  it("lets a failure other than the read's surface from the preview", async () => {
    const saved = new ComposerAttachment(new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png"));
    const failure = new Error("The answer is malformed.");

    await expect(saved.loadPreview(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(saved.loadPreview(() => Promise.reject(new Error("No code.")))).rejects.toThrow("No code.");
    await expect(saved.loadPreview(() => Promise.reject("offline"))).rejects.toBe("offline");
    expect(saved.previewUrl()).toBeNull();
  });

  it("rejects with the grant's failure when the file is not granted", async () => {
    const failure = new Error("The attachment could not be read. Try adding it again.");

    await expect(new ComposerAttachment(new File(["a"], "gone.txt", { type: "text/plain" })).toInput(() => Promise.reject(failure))).rejects.toBe(failure);
  });

  it("sends a saved file by its stored path, without reading it again or showing a preview until one is read", async () => {
    const saved = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");

    const attachment = new ComposerAttachment(saved);
    const grant = vi.fn<(file: File) => Promise<string>>();
    const input = await attachment.toInput(grant);

    expect(attachment.isImage).toBe(true);
    expect(attachment.isSaved).toBe(true);
    expect(attachment.previewUrl()).toBeNull();
    expect(attachment.size).toBe(5);
    expect(input.path).toBe(saved.path);
    expect(input.data).toBeNull();
    expect(input.mediaType).toBe("image/png");
    expect(read).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
    attachment.dispose();
  });

  it("sends a picked file by its stored path once it is saved", async () => {
    const attachment = new ComposerAttachment(new File(["a"], "notes.txt", { type: "text/plain" }));
    expect(attachment.isSaved).toBe(false);

    attachment.markSaved(new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/notes.txt"));
    const grant = vi.fn<(file: File) => Promise<string>>();
    const input = await attachment.toInput(grant);

    expect(input.path).toBe("D:/data/attachments/drafts/c1/notes.txt");
    expect([input.data, input.grant]).toEqual([null, null]);
    expect(grant).not.toHaveBeenCalled();
  });
});
