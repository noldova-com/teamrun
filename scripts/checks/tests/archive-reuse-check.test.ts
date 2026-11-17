/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { describe, it } from "node:test";

import { PackageException } from "../../packages/package.exception.ts";
import { ArchiveReuseCheck } from "../archive-reuse-check.ts";

const CLI = "@noldova/teamrun.cli";
const WINDOW = "@noldova/teamrun.window";
const TEAMRUN = "@noldova/teamrun";
const HASHES: ReadonlyMap<string, string> = new Map([[CLI, "sha512-cli"], [WINDOW, "sha512-window"], [TEAMRUN, "sha512-teamrun"]]);
const REBUILT: ReadonlyMap<string, boolean> = new Map([[CLI, true], [WINDOW, true], [TEAMRUN, false]]);

const runWith = async (after: ReadonlyMap<string, string>, built: ReadonlyMap<string, boolean> | Error): Promise<{ passed: boolean; text: string; asked: readonly string[] }> => {
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const hashes = [HASHES, after];
  let asked: readonly string[] = [];
  const check = new ArchiveReuseCheck(async () => await Promise.resolve(hashes.shift() ?? new Map()), async names => {
    asked = names;
    return built instanceof Error ? await Promise.reject(built) : await Promise.resolve(built);
  });
  const passed = await check.runAsync(output);
  return { passed, text, asked };
};

describe("ArchiveReuseCheck", () => {
  it("passes when the rebuilt packages pack the same archives and the others are reused", async () => {
    const result = await runWith(HASHES, REBUILT);

    assert.equal(result.passed, true);
    assert.deepEqual(result.asked, [CLI, WINDOW]);
    assert.equal(result.text, `Rebuilt ${CLI} and ${WINDOW} at the same time, packed the same archives and reused the other packages: 1.\n`);
  });

  it("fails on a changed archive and names the package and both hashes", async () => {
    const result = await runWith(new Map([...HASHES, [WINDOW, "sha512-other"]]), REBUILT);

    assert.equal(result.passed, false);
    assert.equal(result.text, `${WINDOW}'s archive differs from the one before the rebuild: sha512-window before, sha512-other after.\n`);
  });

  it("fails when a package that depends on the rebuilt ones is built instead of reused", async () => {
    const result = await runWith(HASHES, new Map([...REBUILT, [TEAMRUN, true]]));

    assert.equal(result.passed, false);
    assert.equal(result.text, `${TEAMRUN} was built, though it is reused when the rebuilt archives are the same as before.\n`);
  });

  it("fails when a package it rebuilds is reused or isn't there", async () => {
    const result = await runWith(HASHES, new Map([[WINDOW, false], [TEAMRUN, false]]));

    assert.equal(result.passed, false);
    assert.equal(result.text, `${CLI} isn't a package under src/, so the check can't rebuild it.\n${WINDOW} was reused, though the check rebuilds it.\n`);
  });

  it("fails with the build's message when the rebuild fails", async () => {
    const result = await runWith(HASHES, new PackageException(`Compiling ${WINDOW} failed.`));

    assert.equal(result.passed, false);
    assert.equal(result.text, `Compiling ${WINDOW} failed.\n`);
  });
});
