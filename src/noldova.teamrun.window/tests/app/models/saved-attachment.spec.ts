/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageAttachment } from "@noldova/teamrun.protocol";

import { FileShare } from "../../../src/app/models/file-share";
import { SavedAttachment } from "../../../src/app/models/saved-attachment";

describe("SavedAttachment", () => {
  const address = "desktop-file://0123456789abcdef0123456789abcdef/";
  const discard = vi.fn();
  const read = vi.fn((_path: string) => Promise.resolve(new FileShare(address, discard)));
  const saved = new MessageAttachment("picture.png", "image/png", 5, "D:/data/attachments/drafts/c1/picture.png");

  afterEach(() => {
    read.mockClear();
    discard.mockClear();
  });

  it("previews a saved image by the address its stored path is shared at, and releases the share once when disposed", async () => {
    const attachment = new SavedAttachment(saved);

    await attachment.loadPreview(read);

    expect(read).toHaveBeenCalledWith(saved.path);
    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([address, saved.path, 0]);
    attachment.dispose();
    attachment.dispose();
    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
  });

  it("releases a share that answers after the attachment is disposed, and shows nothing", async () => {
    const late = new SavedAttachment(saved);
    const loading = late.loadPreview(read);
    late.dispose();
    await loading;

    expect([late.previewUrl(), late.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
  });

  it("drops a saved image's preview and releases its share when its address fails to load", async () => {
    const attachment = new SavedAttachment(saved);
    await attachment.loadPreview(read);

    attachment.previewFailed();

    expect([attachment.previewUrl(), attachment.sharedPath, discard.mock.calls.length]).toEqual([null, null, 1]);
    attachment.dispose();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("sends a saved file by its stored path, without reading it again or showing a preview until one is read", async () => {
    const attachment = new SavedAttachment(saved);
    const input = await attachment.toInput();

    expect(attachment.isImage).toBe(true);
    expect(attachment.isSaved).toBe(true);
    expect(attachment.previewUrl()).toBeNull();
    expect(attachment.size).toBe(5);
    expect(input.path).toBe(saved.path);
    expect([input.data, input.grant]).toEqual([null, null]);
    expect(input.mediaType).toBe("image/png");
    expect(read).not.toHaveBeenCalled();
    attachment.dispose();
  });

  it("sends and shares the path it was saved at last", async () => {
    const attachment = new SavedAttachment(new MessageAttachment("picture.png", "image/png", 5, "D:/data/messages/m1/picture.png"));

    attachment.markSaved(saved);
    const input = await attachment.toInput();
    await attachment.loadPreview(read);

    expect([input.path, attachment.sharedPath]).toEqual([saved.path, saved.path]);
    expect(read).toHaveBeenCalledWith(saved.path);
    attachment.dispose();
  });
});
