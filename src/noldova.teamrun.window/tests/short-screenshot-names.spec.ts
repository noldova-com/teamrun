/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { onTestFinished } from "vitest";
import { commands, page, server } from "vitest/browser";

describe("Screenshot names", () => {
  const folder = `${server.config.attachmentsDir}/screenshot-names`;
  const fileName = (path: string): string => path.replace(/^.*[\\/]/u, "");
  const bytesOf = (text: string): number => new TextEncoder().encode(text).length;
  const longStem = (): string => `${"A-test-title-past-what-a-file-name-may-hold-".repeat(6)}${crypto.randomUUID()}`;

  it("saves a screenshot whose file name is past the 255 bytes a file name may take under its first 100 bytes and a 16-character hash of it, keeping its extension",
    async () => {
      const stem = longStem();
      expect(bytesOf(`${stem}.png`)).toBeGreaterThan(255);

      const path = await page.screenshot({ path: `${folder}/${stem}.png` });
      onTestFinished(() => commands.removeFile(path));
      const saved = fileName(path);

      expect(saved).toMatch(/^A-test-title-past-what-a-file-name-may-hold-[\w-]*-[\da-f]{16}\.png$/u);
      expect(stem.startsWith(saved.slice(0, -"-0123456789abcdef.png".length))).toBe(true);
      expect(bytesOf(saved)).toBe(100 + "-0123456789abcdef.png".length);
      expect(await commands.readFile(path, "base64")).not.toBe("");
    });

  it("keeps a file name that fits as it is", async () => {
    const name = `short-${crypto.randomUUID()}.png`;

    const path = await page.screenshot({ path: `${folder}/${name}` });
    onTestFinished(() => commands.removeFile(path));

    expect(fileName(path)).toBe(name);
  });

  it("gives the image back beside the shortened path when asked for base64, and alone when not saving, as Vitest's own command does", async () => {
    const saved = await page.screenshot({ path: `${folder}/${longStem()}.png`, base64: true });
    onTestFinished(() => commands.removeFile(saved.path));
    const image = await page.screenshot({ save: false });

    expect([fileName(saved.path), saved.base64, image]).toEqual([expect.stringMatching(/-[\da-f]{16}\.png$/u), expect.stringMatching(/^iVBOR/u),
      expect.stringMatching(/^iVBOR/u)]);
  });
});
