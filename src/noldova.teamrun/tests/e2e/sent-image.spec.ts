/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { crc32, deflateSync } from "node:zlib";

import { expect, type Locator } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const WIDTH: number = 48;
const HEIGHT: number = 32;
const TEXT: string = "Here is a picture.";

function chunkOf(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, tail]);
}

function pngOf(width: number, height: number): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([0x33, 0x77, 0xaa]))]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunkOf("IHDR", header),
    chunkOf("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunkOf("IEND", Buffer.alloc(0))]);
}

type Box = { x: number; y: number; width: number; height: number };

async function boxesOf(message: Locator, figure: string, parts: readonly string[]): Promise<Box[]> {
  const found = await message.evaluate((element: Element, names: { figure: string; parts: readonly string[] }) => {
    const figures = element.querySelectorAll(names.figure);
    const matches = [[element], figures, ...names.parts.map(t => figures.length === 1 ? figures[0]?.querySelectorAll(t) ?? [] : [])];
    return matches.map(t => {
      const only = t.length === 1 ? t[0] : undefined;
      return { count: t.length, box: only ? (({ x, y, width, height }: DOMRect) => ({ x, y, width, height }))(only.getBoundingClientRect()) : null };
    });
  }, { figure, parts });
  expect(found.map(t => t.count)).toEqual([1, 1, ...parts.map(() => 1)]);
  return found.map(t => t.box ?? { x: 0, y: 0, width: 0, height: 0 });
}

function expectInside(inner: Box, outer: Box): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
}

test.describe("a sent message's image", () => {
  test("shows in the history inside its message, at its own size and shape, from its desktop-file share", async ({ app }) => {
    const page = await app.openChatAsync();
    await page.locator("input[type=file]").setInputFiles({ name: "picture.png", mimeType: "image/png", buffer: pngOf(WIDTH, HEIGHT) });
    await expect(page.locator(".nol-teamrun-composer-preview")).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole("combobox", { name: "Message", exact: true }).fill(TEXT);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByText("No one in this chat takes images.")).toHaveCount(0);

    await app.sendAsync(TEXT);

    const message = page.locator("nol-teamrun-history-message", { hasText: TEXT });
    const figure = message.locator(".nol-teamrun-image-preview");
    const image = figure.locator("img.nol-teamrun-image[alt='picture.png']");
    await expect(image).toHaveAttribute("src", /^desktop-file:\/\//, { timeout: 60_000 });
    await expect.poll(() => image.evaluate((t: HTMLImageElement) => t.complete ? [t.naturalWidth, t.naturalHeight] : []), TeamRunApp.pollOf(30_000))
      .toEqual([WIDTH, HEIGHT]);
    const [messageBox, figureBox, frameBox, imageBox] = await boxesOf(message, ".nol-teamrun-image-preview",
      [".nol-teamrun-image-frame", "img.nol-teamrun-image[alt='picture.png']"]);
    expect(figureBox.width).toBeCloseTo(WIDTH, 0);
    expect(frameBox.width / frameBox.height).toBeCloseTo(WIDTH / HEIGHT, 1);
    expect(imageBox.width / imageBox.height).toBeCloseTo(WIDTH / HEIGHT, 1);
    expectInside(figureBox, messageBox);
    expectInside(imageBox, frameBox);
    expect(app.unexpectedFailures).toEqual([]);
  });
});
