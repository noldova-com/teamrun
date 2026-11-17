/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { VersionFileCheck } from "../version-file-check.ts";

const folders: string[] = [];

const rootWith = (versionFile: string | null, manifest: string = JSON.stringify({ name: "sample", version: "0.0.2" })): string => {
  const root = mkdtempSync(path.join(tmpdir(), "version-file-"));
  folders.push(root);
  writeFileSync(path.join(root, "package.json"), manifest);
  if (versionFile !== null)
    writeFileSync(path.join(root, "version.json"), versionFile);
  return root;
};

const runIn = async (root: string): Promise<{ passed: boolean; text: string }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const passed = await new VersionFileCheck(root).runAsync(output);
  return { passed, text };
};

describe("VersionFileCheck", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("passes when version.json holds the root package.json's version", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" })));

    assert.equal(passed, true);
    assert.match(text, /both hold 0\.0\.2/);
  });

  it("fails when the versions differ", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.1" })));

    assert.equal(passed, false);
    assert.match(text, /version\.json holds the version 0\.0\.1, but the root package\.json.* holds 0\.0\.2/);
  });

  it("fails, naming the file, when version.json is missing", async () => {
    const { passed, text } = await runIn(rootWith(null));

    assert.equal(passed, false);
    assert.match(text, /The root version\.json can't be read/);
  });

  it("fails, naming the file, when version.json isn't JSON", async () => {
    const { passed, text } = await runIn(rootWith("{ version: 0.0.2"));

    assert.equal(passed, false);
    assert.match(text, /The root version\.json isn't valid JSON/);
  });

  it("fails, naming the file, when version.json has no version", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ name: "sample" })));

    assert.equal(passed, false);
    assert.match(text, /The root version\.json holds no version string in its "version" field, but null/);
  });

  it("fails, naming the file, when a version isn't a string", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" }), JSON.stringify({ version: 2 })));

    assert.equal(passed, false);
    assert.match(text, /The root package\.json holds no version string in its "version" field, but 2/);
  });
});
