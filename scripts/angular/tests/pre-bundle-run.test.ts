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

import { PreBundleRun } from "../pre-bundle-run.ts";

const directory = path.join(path.sep, "work", "src");

const cacheOf = (environment: NodeJS.ProcessEnv): string | undefined => new PreBundleRun(directory, environment).config()?.cacheDir;

describe("PreBundleRun", () => {
  it("gives each run a key of its own and keeps the other variables", () => {
    const given = { PATH: "bin", NOLDOVA_TEST_RETRY: "1" };
    const first = PreBundleRun.environment(given);
    const second = PreBundleRun.environment(given);
    assert.equal(first["PATH"], "bin");
    assert.equal(first["NOLDOVA_TEST_RETRY"], "1");
    assert.notEqual(first[PreBundleRun.VARIABLE], second[PreBundleRun.VARIABLE]);
    assert.equal(PreBundleRun.VARIABLE in given, false);
  });

  it("puts each run's cache in its own folder inside the one cleared before every run", () => {
    const first = cacheOf(PreBundleRun.environment({}));
    const second = cacheOf(PreBundleRun.environment({}));
    assert.notEqual(first, undefined);
    assert.notEqual(first, second);
    for (const folder of [first, second])
      assert.equal(path.dirname(folder ?? ""), path.join(directory, PreBundleRun.FOLDER));
  });

  it("leaves the cache folder to Vitest for a run without a key", () => {
    assert.equal(new PreBundleRun(directory, {}).config(), null);
  });

  it("leaves the cache folder to Vitest for a key that isn't one it gave", () => {
    for (const key of ["", "..", `..${path.sep}..${path.sep}elsewhere`, "0f8fad5b-d9cb-469f-a165-70867728950e/deps", "0F8FAD5B-D9CB-469F-A165-70867728950E"])
      assert.equal(new PreBundleRun(directory, { [PreBundleRun.VARIABLE]: key }).config(), null, key);
  });
});
