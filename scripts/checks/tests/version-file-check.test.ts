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

import "@noldova/context.core";

import { VersionSetter } from "../../packages/version-setter.ts";
import { VersionFileCheck } from "../version-file-check.ts";

const folders: string[] = [];

const manifest = (version: unknown): string => JSON.stringify({ name: "sample", version });

const rootWith = (versionFile: string | null, manifests: Readonly<Record<string, string | null>> = {}): string => {
  const root = mkdtempSync(path.join(tmpdir(), "version-file-"));
  folders.push(root);
  for (const file of [...VersionSetter.MANIFESTS, "src/noldova.teamrun/module.json"]) {
    const text = Object.hasOwn(manifests, file) ? manifests[file] : manifest("0.0.2");
    if (Object.isNullOrUndefined(text))
      continue;
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  if (!Object.isNull(versionFile))
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

  it("reads every package.json and text file that set-version writes", () => {
    assert.deepEqual(VersionSetter.MANIFESTS, ["package.json", "src/package.json", "app/package.json", "app/src/noldova.teamrun.window.app/package.json"]);
    assert.deepEqual(VersionSetter.TEXT_FILES, ["version.json", "src/noldova.teamrun/module.json"]);
  });

  it("passes when version.json and every package.json hold the same version", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" })));

    assert.equal(passed, true);
    assert.equal(text, "version.json, src/noldova.teamrun/module.json, package.json, src/package.json, app/package.json, app/src/noldova.teamrun.window.app/package.json all hold 0.0.2.\n");
  });

  for (const file of ["src/noldova.teamrun/module.json", "package.json", "src/package.json", "app/package.json", "app/src/noldova.teamrun.window.app/package.json"]) {
    it(`fails, naming the file, when ${file} holds another version`, async () => {
      const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" }), { [file]: manifest("0.0.1") }));

      assert.equal(passed, false);
      assert.equal(text, `${file} holds the version 0.0.1, but version.json holds 0.0.2; npm run set-version moves only the files that hold version.json's version, and the release compares app/package.json's with the version it builds, so each holds it.\n`);
    });
  }

  it("names every file that differs", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.1" })));

    assert.equal(passed, false);
    assert.equal(text.split("\n").filter(line => line.includes("but version.json holds 0.0.1")).length, 5);
  });

  it("fails, naming the file, when version.json is missing", async () => {
    const { passed, text } = await runIn(rootWith(null));

    assert.equal(passed, false);
    assert.match(text, /^version\.json can't be read/);
  });

  it("fails, naming the file, when src/noldova.teamrun/module.json is missing", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" }), { "src/noldova.teamrun/module.json": null }));

    assert.equal(passed, false);
    assert.match(text, /^src\/noldova\.teamrun\/module\.json can't be read/);
  });

  it("fails, naming the file, when app/package.json is missing", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" }), { "app/package.json": null }));

    assert.equal(passed, false);
    assert.match(text, /^app\/package\.json can't be read/);
  });

  it("fails, naming the file, when version.json isn't JSON", async () => {
    const { passed, text } = await runIn(rootWith("{ version: 0.0.2"));

    assert.equal(passed, false);
    assert.match(text, /^version\.json isn't valid JSON/);
  });

  it("fails, naming the file, when version.json has no version", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ name: "sample" })));

    assert.equal(passed, false);
    assert.match(text, /^version\.json holds no version string in its "version" field, but null/);
  });

  it("fails, naming the file, when a version isn't a string", async () => {
    const { passed, text } = await runIn(rootWith(JSON.stringify({ version: "0.0.2" }), { "package.json": manifest(2) }));

    assert.equal(passed, false);
    assert.match(text, /^package\.json holds no version string in its "version" field, but 2/);
  });
});
