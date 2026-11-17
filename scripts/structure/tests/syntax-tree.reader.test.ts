/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import ts from "typescript";

import { SyntaxTreeReader } from "../syntax-tree.reader.ts";

const SOURCES: Readonly<Record<string, string>> = {
  "scripts/page.ts": "export interface IPage {}\nexport class Page {}\n",
  "scripts/page.js": "export const page = 1;\n",
  "scripts/page.mjs": "export const pages = [];\n",
  "src/app.ts": "export const app = 1;\n"
};

describe("SyntaxTreeReader", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "syntax-tree-"));
    for (const [file, text] of Object.entries(SOURCES)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
    }
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads nothing from no files", async () => {
    assert.deepEqual(await new SyntaxTreeReader(root).readAsync([], () => ["read"]), []);
  });

  it("gives each file's results in the order of the files, flattened", async () => {
    const files = ["src/app.ts", "scripts/page.ts", "scripts/page.js"];

    assert.deepEqual(await new SyntaxTreeReader(root).readAsync(files, (t, u) => u.statements.map(v => `${t}: ${v.getText(u)}`)), [
      "src/app.ts: export const app = 1;",
      "scripts/page.ts: export interface IPage {}",
      "scripts/page.ts: export class Page {}",
      "scripts/page.js: export const page = 1;"
    ]);
  });

  it("parses .js and .mjs files as JavaScript and .ts files as TypeScript, with parent nodes set", async () => {
    const files = ["scripts/page.ts", "scripts/page.js", "scripts/page.mjs"];

    assert.deepEqual(await new SyntaxTreeReader(root).readAsync(files, (t, u) => [[t, (u.flags & ts.NodeFlags.JavaScriptFile) !== 0, u.statements.every(v => v.parent === u)]]), [
      ["scripts/page.ts", false, true],
      ["scripts/page.js", true, true],
      ["scripts/page.mjs", true, true]
    ]);
  });

  it("fails on a file that isn't there", async () => {
    await assert.rejects(new SyntaxTreeReader(root).readAsync(["scripts/missing.ts"], () => []), { code: "ENOENT" });
  });
});
