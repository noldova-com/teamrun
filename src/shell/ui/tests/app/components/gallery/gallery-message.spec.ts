/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryMessage } from "../../../../src/app/components/gallery/gallery-message";

describe("GalleryMessage", () => {
  it("keeps its key, heading, text and code, and gives a copy with other text under the same key", () => {
    const message = new GalleryMessage("7", "Ada · message 8", "Ready", "const a = 1;");
    const longer = message.withText("Ready to ship");

    expect([message.key, message.heading, message.text, message.code]).toEqual(["7", "Ada · message 8", "Ready", "const a = 1;"]);
    expect([longer.key, longer.heading, longer.text, longer.code]).toEqual(["7", "Ada · message 8", "Ready to ship", "const a = 1;"]);
  });
});
