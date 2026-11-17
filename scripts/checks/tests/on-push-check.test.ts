/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { OnPushCheck } from "../on-push-check.ts";

const folders: string[] = [];

const KEY = ["changeDetection", ""].join(":");
const ON_PUSH = ["ChangeDetectionStrategy", "OnPush"].join(".");

const rootWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(path.join(tmpdir(), "on-push-"));
  folders.push(root);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return root;
};

const runIn = async (root: string, files: readonly string[]): Promise<{ passed: boolean; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const passed = await new OnPushCheck(root, async () => await Promise.resolve(files)).runAsync(output);
  return { passed, text };
};
describe("OnPushCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("passes components that leave changeDetection out or choose Eager, and reads only TypeScript", async () => {
    const files = {
      "src/a.component.ts": "@Component({\n  selector: \"nol-a\"\n})\n",
      "src/b.component.ts": `@Component({\n  ${KEY} ChangeDetectionStrategy.Eager\n})\n`,
      "src/c.component.tsx": `${KEY} ${ON_PUSH}\n`,
      "documents/ANGULAR.md": `${KEY} ${ON_PUSH}\n`
    };

    const { passed, text } = await runIn(rootWith(files), Object.keys(files));

    assert.equal(passed, true);
    assert.match(text, /Read 2 TypeScript files for a changeDetection other than Eager\./);
  });

  it("fails when the repository holds no TypeScript file, as it read nothing", async () => {
    const files = { "documents/ANGULAR.md": "# Angular\n" };

    const { passed, text } = await runIn(rootWith(files), Object.keys(files));

    assert.equal(passed, false);
    assert.match(text, /found no TypeScript file in the repository, so it read nothing\./);
  });

  it("fails each changeDetection other than Eager with its file and line, spaced or not", async () => {
    const files = {
      "src/a.component.ts": `@Component({\n  selector: "nol-a",\n  ${KEY} ${ON_PUSH}\n})\n`,
      "src/b.component.mts": `@Component({\n  changeDetection\n    : ChangeDetectionStrategy.Default\n})\n`,
      "src/c.component.ts": `@Component({ ${KEY} 0 })\n`
    };

    const { passed, text } = await runIn(rootWith(files), Object.keys(files));

    assert.equal(passed, false);
    assert.deepEqual(text.split("\n").filter(t => t.includes("other than Eager;")).map(t => t.split(" ")[0]), ["src/a.component.ts:3", "src/b.component.mts:2", "src/c.component.ts:1"]);
  });
});
