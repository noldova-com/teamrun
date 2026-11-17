/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageAttachment } from "@noldova/teamrun.protocol";

import { ImageViewerData } from "../../../src/app/models/image-viewer-data";
import { ViewedImage } from "../../../src/app/models/viewed-image";
import { ImageHeaders } from "../../fixtures/image-headers.fixture";

describe("ViewedImage", () => {
  const attachment = new MessageAttachment("plan.png", "image/png", 12, "D:/data/attachments/c1/plan.png");

  it("views a conversation's attachment by its saved path", () => {
    const image = ViewedImage.of("c1", attachment);

    expect([image.key, image.conversationId, image.name, image.mediaType, image.path, image.data])
      .toEqual(["D:/data/attachments/c1/plan.png", "c1", "plan.png", "image/png", "D:/data/attachments/c1/plan.png", null]);
  });

  it("views a generated image from its own bytes, in its conversation, with no path", () => {
    const image = ViewedImage.fromData("d7", "c1", "Generated image", "image/webp", "UklGRg==");

    expect([image.key, image.conversationId, image.name, image.mediaType, image.path, image.data])
      .toEqual(["d7", "c1", "Generated image", "image/webp", null, "UklGRg=="]);
  });

  it("views a Markdown image's base64 data URL of an image type it shows, keyed by its message and place, and nothing else", () => {
    const png = ImageHeaders.png(600, 300);
    const image = ViewedImage.fromDataUrl("c1", "m4", 2, ` DATA:Image/PNG;base64,${png.slice(0, 10)}\n ${png.slice(10)} `);

    expect([image?.key, image?.conversationId, image?.name, image?.mediaType, image?.path, image?.data, image?.messageId])
      .toEqual(["m4:markdown:2", "c1", "Image", "image/png", null, png, null]);
    expect([["image/jpeg", ImageHeaders.jpeg(600, 300)], ["image/gif", ImageHeaders.gif(600, 300)], ["image/webp", ImageHeaders.lossyWebp(600, 300)],
      ["image/svg+xml", "AAAA"]].map(([type, data]) => ViewedImage.fromDataUrl("c1", "m4", 0, `data:${type};base64,${data}`)?.mediaType))
      .toEqual(["image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
    expect(["data:text/html;base64,PGI+", "data:image/svg+xml,<svg/>", "data:image/png;base64,AA*A", "data:image/bmp;base64,Qk0=", "data:image/png;base64,AAAA",
      "https://example.com/a.png", "out/a.png"].map(t => ViewedImage.fromDataUrl("c1", "m4", 0, t))).toEqual([null, null, null, null, null, null, null]);
  });

  it("views a data URL only up to an attachment image's 10 MiB of decoded bytes", () => {
    const limit = 10 * 1024 * 1024;
    const header = ImageHeaders.png(1, 1);
    const ofBytes = (bytes: number): string => `data:image/png;base64,${header}${"A".repeat(Math.ceil(bytes * 4 / 3) - header.length)}`;

    expect(ViewedImage.fromDataUrl("c1", "m4", 0, ofBytes(limit))?.mediaType).toBe("image/png");
    expect(ViewedImage.fromDataUrl("c1", "m4", 0, ofBytes(limit + 1))).toBeNull();
    expect(ViewedImage.fromDataUrl("c1", "m4", 0, `data:image/svg+xml;base64,${"A".repeat(Math.ceil((limit + 1) * 4 / 3))}`)).toBeNull();
  });

  it("views a data URL only up to 40 million pixels, as its header says, before anything decodes it", () => {
    const cases: readonly [string, string][] = [["image/png", ImageHeaders.png(8000, 5000)], ["image/png", ImageHeaders.png(8000, 5001)],
      ["image/jpeg", ImageHeaders.jpeg(10_000, 4000)], ["image/jpeg", ImageHeaders.jpeg(10_000, 4001)], ["image/gif", ImageHeaders.gif(65_535, 65_535)],
      ["image/webp", ImageHeaders.extendedWebp(16_383, 16_383)], ["image/webp", ImageHeaders.losslessWebp(5000, 8000)]];

    expect(cases.map(([type, data]) => !Object.isNull(ViewedImage.fromDataUrl("c1", "m4", 0, `data:${type};base64,${data}`))))
      .toEqual([true, false, true, false, false, false, true]);
  });

  it("views an image a reply generated from its bytes, in the reply's conversation, keyed by its message and detail, named by where it was saved", () => {
    const image = ViewedImage.generated("c1", "m4", 3, "C:\\Users\\me\\.codex\\generated_images\\sun.png", "image/png", "iVBORw==");

    expect([image.key, image.conversationId, image.name, image.mediaType, image.path, image.data, image.messageId])
      .toEqual(["m4:3", "c1", "sun.png", "image/png", null, "iVBORw==", null]);
    expect(ViewedImage.generated("c1", "m4", 5, null, "image/webp", "UklGRg==").name).toBe("Generated image");
  });

  it("views TeamRun's stored copy of a generated image by its message and path, named by where it was saved", () => {
    const image = ViewedImage.stored("c1", "m4", "D:\\data\\images\\m4-3.jpg", "C:\\Users\\me\\.codex\\generated_images\\sun.jpeg");

    expect([image.key, image.conversationId, image.name, image.mediaType, image.path, image.data, image.messageId])
      .toEqual(["m4:D:\\data\\images\\m4-3.jpg", "c1", "sun.jpeg", "image/jpeg", "D:\\data\\images\\m4-3.jpg", null, "m4"]);
    expect(ViewedImage.stored("c1", "m4", "D:\\data\\images\\m4-5.webp", null).name).toBe("Generated image");
    expect(ViewedImage.fromInstance(image.toInstance())).toEqual(image);
  });

  it("views an image a reply wrote by its message and path, its kind and name taken from the path", () => {
    const image = ViewedImage.written("c1", "m4", "D:\\work\\app\\out/Chart.JPEG");

    expect([image.key, image.conversationId, image.name, image.mediaType, image.path, image.data, image.messageId])
      .toEqual(["m4:D:\\work\\app\\out/Chart.JPEG", "c1", "Chart.JPEG", "image/jpeg", "D:\\work\\app\\out/Chart.JPEG", null, "m4"]);
    expect(ViewedImage.written("c1", "m4", "D:\\work\\app\\shot.png").name).toBe("shot.png");
    expect(ViewedImage.written("c1", "m4", "/home/me/app/plot.webp").name).toBe("plot.webp");
    expect(ViewedImage.written("c1", "m4", "/home/me/app/Diagram.SVG").mediaType).toBe("image/svg+xml");
    expect(ViewedImage.written("c1", "m4", "/home/me/app/plot.webp", 3).key).toBe("m4:3:/home/me/app/plot.webp");
    expect(ViewedImage.fromInstance(image.toInstance())).toEqual(image);
  });

  it("names a tab's instance without the bytes, and reads it back with its chat", () => {
    const attached = ViewedImage.fromInstance(ViewedImage.of("c1", attachment).toInstance());
    const generated = ViewedImage.fromData("d7", "c1", "Generated image", "image/webp", "UklGRg==");

    expect(attached).toEqual(ViewedImage.of("c1", attachment));
    expect(ViewedImage.fromInstance(JSON.stringify({ key: "k", chatId: "c1", name: "a.png", mediaType: "image/png", path: "a.png" }))?.messageId).toBeNull();
    expect(generated.toInstance()).not.toContain("UklGRg==");
    expect(ViewedImage.fromInstance(generated.toInstance())).toEqual(new ViewedImage("d7", "c1", "Generated image", "image/webp", null, null));
  });

  it.each([
    ["text that isn't JSON", "plan.png"],
    ["a list", "[]"],
    ["no key", JSON.stringify({ chatId: "c1", name: "a.png", mediaType: "image/png", path: "a.png" })],
    ["a number for a name", JSON.stringify({ key: "k", chatId: "c1", name: 7, mediaType: "image/png", path: "a.png" })],
    ["a path that is neither text nor null", JSON.stringify({ key: "k", chatId: "c1", name: "a.png", mediaType: "image/png", path: 3 })],
    ["a message that is neither text nor null", JSON.stringify({ key: "k", chatId: "c1", name: "a.png", mediaType: "image/png", path: "a.png", messageId: 3 })],
    ["a chat that is neither text nor null", JSON.stringify({ key: "k", chatId: 3, conversationId: "c1", name: "a.png", mediaType: "image/png", path: "a.png" })],
    ["an earlier version's chat that is neither text nor null", JSON.stringify({ key: "k", conversationId: 3, name: "a.png", mediaType: "image/png", path: "a.png" })]
  ])("refuses an instance with %s", (_, instance) => {
    expect(ViewedImage.fromInstance(instance)).toBeNull();
  });

  it("keeps its chat as chatId in a tab's instance, and reads the chat of a tab an earlier version kept as conversationId", () => {
    const earlier = { key: "k", conversationId: "c1", name: "a.png", mediaType: "image/png", path: "a.png", messageId: "m1" };
    const image = ViewedImage.fromInstance(JSON.stringify(earlier));

    expect(image).toEqual(new ViewedImage("k", "c1", "a.png", "image/png", "a.png", null, "m1"));
    expect(JSON.parse(image!.toInstance())).toEqual({ key: "k", chatId: "c1", name: "a.png", mediaType: "image/png", path: "a.png", messageId: "m1" });
    expect(ViewedImage.fromInstance(JSON.stringify({ ...earlier, chatId: null }))?.conversationId).toBeNull();
  });

  it("starts the viewer at the chosen image among the message's images, or alone when it isn't among them", () => {
    const first = ViewedImage.of("c1", attachment);
    const second = ViewedImage.fromData("d7", "c1", "Generated image", "image/png", "iVBORw==");
    const among = new ImageViewerData(second, [first, second]);
    const alone = new ImageViewerData(second, [first]);

    expect([among.images, among.index]).toEqual([[first, second], 1]);
    expect([alone.images, alone.index]).toEqual([[second], 0]);
  });
});
