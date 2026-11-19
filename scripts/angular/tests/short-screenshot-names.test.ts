/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import type { IScreenshotCommandContext } from "../interfaces/i-screenshot-command-context.ts";
import type { IScreenshotOptions } from "../interfaces/i-screenshot-options.ts";
import { ShortScreenshotNames } from "../short-screenshot-names.ts";

const folder = path.join(path.sep, "work", "failure-screenshots", "spec.ts");
const longName = `${"fails-with-a-title-past-what-a-file-name-may-hold-".repeat(6)}1.png`;
const image = Buffer.from("image");

const fakeContext = (): IScreenshotCommandContext & { readonly sent: (readonly [string, string, IScreenshotOptions])[]; readonly logged: string[] } => {
  const sent: (readonly [string, string, IScreenshotOptions])[] = [];
  const logged: string[] = [];
  return {
    sent,
    logged,
    project: { vitest: { logger: { log: message => void logged.push(message) }, onClose: () => undefined } },
    triggerCommand: (command, name, options) => {
      sent.push([command, name, options]);
      return Promise.resolve({ buffer: image, path: options.path ?? name });
    }
  };
};

describe("ShortScreenshotNames", () => {
  it("keeps a path whose file name fits in 255 bytes", () => {
    const fits = path.join(folder, `${"a".repeat(251)}.png`);

    assert.equal(ShortScreenshotNames.shorten(fits), fits);
  });

  it("cuts a longer file name to its first 100 bytes, a hyphen, 16 digits of its hash and its extension", () => {
    const short = ShortScreenshotNames.shorten(path.join(folder, longName));
    const name = path.basename(short);

    assert.equal(path.dirname(short), folder);
    assert.match(name, /^fails-with-a-title-past-what-a-file-name-may-hold-[\w-]*-[\da-f]{16}\.png$/u);
    assert.equal(longName.startsWith(name.slice(0, -"-0123456789abcdef.png".length)), true);
    assert.equal(Buffer.byteLength(name), ShortScreenshotNames.KEPT + "-0123456789abcdef.png".length);
  });

  it("gives two long names that share their start names of their own", () => {
    const first = ShortScreenshotNames.shorten(`${longName}-first.png`);
    const second = ShortScreenshotNames.shorten(`${longName}-second.png`);

    assert.notEqual(first, second);
    assert.equal(first.slice(0, -"0123456789abcdef.png".length), second.slice(0, -"0123456789abcdef.png".length));
  });

  it("never splits a character that takes more than one byte", () => {
    const name = ShortScreenshotNames.shorten(`ab${"€".repeat(100)}.png`);

    assert.equal(Buffer.from(name).toString(), name);
    assert.match(name, /^ab€{32}-[\da-f]{16}\.png$/u);
    assert.equal(Buffer.byteLength(name), 98 + "-0123456789abcdef.png".length);
  });

  it("sends Vitest's failure screenshot, which has no path, to the provider under the cut name and logs the long one beside the saved path", async () => {
    const context = fakeContext();

    const saved = await new ShortScreenshotNames().screenshot(context, path.join(folder, longName), { save: true });

    const [[command, name, options] = ["", "", {}]] = context.sent;
    assert.equal(command, "__vitest_takeScreenshot");
    assert.equal(name, ShortScreenshotNames.shorten(path.join(folder, longName)));
    assert.deepEqual(options, { save: true, base64: undefined });
    assert.equal(saved, name);
    assert.deepEqual(context.logged, [`Screenshot of "${longName}": ${name}`]);
  });

  it("cuts a long path a test gives and keeps the name Vitest gave", async () => {
    const context = fakeContext();

    const saved = await new ShortScreenshotNames().screenshot(context, "test-name", { path: path.join(folder, longName) });

    const [[, name, options] = ["", "", {}]] = context.sent;
    assert.equal(name, "test-name");
    assert.deepEqual(options, { path: ShortScreenshotNames.shorten(path.join(folder, longName)), save: true, base64: undefined });
    assert.equal(saved, options.path);
  });

  it("gives the image beside the path when asked for base64, gives the image alone when not saving, and logs nothing for a name that fits", async () => {
    const context = fakeContext();
    const command = new ShortScreenshotNames();

    const saved = await command.screenshot(context, "short.png", { base64: true });
    const unsaved = await command.screenshot(context, "short.png", { save: false });

    assert.deepEqual(saved, { path: "short.png", base64: image.toString("base64") });
    assert.equal(unsaved, image.toString("base64"));
    assert.deepEqual(context.sent.map(t => t[2]), [{ base64: true, save: true }, { save: false, base64: true }]);
    assert.deepEqual(context.logged, []);
  });
});
