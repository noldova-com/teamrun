/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageAttachment } from "@noldova/teamrun.protocol";

import { FileShare } from "../../../src/app/models/file-share";
import { PickedAttachment } from "../../../src/app/models/picked-attachment";

describe("PickedAttachment", () => {
  const read = vi.fn((_path: string) => Promise.resolve(new FileShare("desktop-file://0123456789abcdef0123456789abcdef/", vi.fn())));

  afterEach(() => read.mockClear());

  it("sends a picked file by the grant issued for it, without its bytes, and names a file without a type as binary", async () => {
    const file = new File([new Uint8Array([0, 1, 2, 255])], "data.bin");
    const attachment = new PickedAttachment(file);
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
    const attachment = new PickedAttachment(new File(["image"], "picture.png", { type: "image/png" }));
    expect(attachment.previewUrl()).toBeNull();

    await attachment.loadPreview(read);

    expect(attachment.previewUrl()).toBe("data:image/png;base64,aW1hZ2U=");
    expect([attachment.mediaType, attachment.sharedPath]).toEqual(["image/png", null]);
    expect(read).not.toHaveBeenCalled();
    attachment.dispose();
    expect(attachment.previewUrl()).toBeNull();
  });

  it("rejects with the grant's failure when the file is not granted", async () => {
    const failure = new Error("The attachment could not be read. Try adding it again.");

    await expect(new PickedAttachment(new File(["a"], "gone.txt", { type: "text/plain" })).toInput(() => Promise.reject(failure))).rejects.toBe(failure);
  });

  it("sends a picked file by its stored path once it is saved", async () => {
    const attachment = new PickedAttachment(new File(["a"], "notes.txt", { type: "text/plain" }));
    expect(attachment.isSaved).toBe(false);

    attachment.markSaved(new MessageAttachment("notes.txt", "text/plain", 1, "D:/data/attachments/drafts/c1/notes.txt"));
    const grant = vi.fn<(file: File) => Promise<string>>();
    const input = await attachment.toInput(grant);

    expect(attachment.isSaved).toBe(true);
    expect(input.path).toBe("D:/data/attachments/drafts/c1/notes.txt");
    expect([input.data, input.grant]).toEqual([null, null]);
    expect(grant).not.toHaveBeenCalled();
  });
});
