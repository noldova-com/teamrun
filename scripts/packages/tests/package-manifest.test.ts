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
import { afterEach, describe, it } from "node:test";

import { PackageManifest } from "../package-manifest.ts";

const folders: string[] = [];
const DIRECTORY = "src/noldova.teamrun.core";
const FILE = `${DIRECTORY}/package.json`;

const readAsync = async (fields: Readonly<Record<string, unknown>>): Promise<PackageManifest> => {
  const root = mkdtempSync(path.join(tmpdir(), "package-manifest-"));
  folders.push(root);
  mkdirSync(path.join(root, DIRECTORY), { recursive: true });
  writeFileSync(path.join(root, FILE), JSON.stringify({ name: "@noldova/teamrun.core", version: "__VERSION__", ...fields }));
  return await PackageManifest.readAsync(root, DIRECTORY);
};

describe("PackageManifest", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("reads a private package with no publishConfig", async () => {
    assert.equal((await readAsync({ private: true })).name, "@noldova/teamrun.core");
  });

  it("refuses a package that isn't marked private, since TeamRun publishes no package to a registry", async () => {
    for (const fields of [{}, { private: false }, { private: "true" }])
      await assert.rejects(readAsync(fields), { message: `${FILE} must be marked "private": true; TeamRun publishes no package to a registry.` });
  });

  it("refuses a private package that still has a publishConfig", async () => {
    await assert.rejects(readAsync({ private: true, publishConfig: { access: "restricted" } }),
      { message: `${FILE} must have no publishConfig; TeamRun publishes no package to a registry.` });
  });

  it("reads the tests a package runs in a process of their own, sorted, and none when it lists none", async () => {
    assert.deepEqual((await readAsync({ private: true, noldova: { isolatedTests: ["b.test.ts", "a/c.test.ts"] } })).isolatedTests, ["a/c.test.ts", "b.test.ts"]);
    assert.deepEqual((await readAsync({ private: true })).isolatedTests, []);
  });

  it("refuses isolated tests that aren't an array of paths", async () => {
    for (const isolatedTests of ["a.test.ts", [1]])
      await assert.rejects(readAsync({ private: true, noldova: { isolatedTests } }),
        { message: `${FILE} must list its isolated tests as an array of paths under its tests folder.` });
  });
});
