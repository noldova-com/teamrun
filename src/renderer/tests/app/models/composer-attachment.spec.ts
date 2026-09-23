/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageAttachment } from "@noldova/teamrun-protocol";

import { ComposerAttachment } from "../../../src/app/models/composer-attachment";

describe("ComposerAttachment", () => {
  it("preserves binary file bytes and reuses saved references without reading them in the composer", async () => {
    const attachment = ComposerAttachment.fromFile(new File([new Uint8Array([0, 1, 2, 255])], "data.bin"));
    const input = await attachment.toInput();
    expect(input.name).toBe("data.bin");
    expect(input.mediaType).toBe("application/octet-stream");
    expect(input.data).toBe("AAEC/w==");
    expect(input.path).toBeNull();
    expect(attachment.image).toBeNull();
    attachment.dispose();
    const saved = ComposerAttachment.fromSaved(new MessageAttachment("saved.png", "image/png", 4, "D:/data/attachments/saved.png"));
    expect((await saved.toInput()).path).toBe("D:/data/attachments/saved.png");
    expect((await saved.toInput()).data).toBeNull();
    expect(saved.image?.path).toBe("D:/data/attachments/saved.png");
    saved.dispose();
  });

  it("releases the local image preview when the draft is removed", () => {
    const createObjectURL = vi.fn(() => "blob:test-preview");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    try {
      const file = new File(["image"], "picture.png", { type: "image/png" });
      const attachment = ComposerAttachment.fromFile(file);
      expect(createObjectURL).toHaveBeenCalledWith(file);
      expect(attachment.image?.data).toBe("blob:test-preview");
      attachment.dispose();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-preview");
    }
    finally {
      vi.unstubAllGlobals();
    }
  });
});
