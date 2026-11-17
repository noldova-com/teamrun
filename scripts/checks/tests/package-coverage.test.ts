/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { PackageCoverage } from "../package-coverage.ts";

const folders: string[] = [];

const measureAsync = async (skipsCoveredDetails: boolean, throughLink: boolean = false): Promise<{ text: string; covered: number; total: number }> => {
  const folder = mkdtempSync(path.join(tmpdir(), "package-coverage-"));
  folders.push(folder);
  const production = path.join(folder, "dist");
  const coverage = path.join(folder, "coverage");
  mkdirSync(production);
  mkdirSync(coverage);
  writeFileSync(path.join(production, "covered-file.js"), "const value = 1;\nglobalThis.coveredValue = value;\n");
  writeFileSync(path.join(production, "uncovered-file.js"), "globalThis.uncoveredValue = 2;\n");
  const run = spawnSync(process.execPath, [path.join(production, "covered-file.js")], { env: { ...process.env, NODE_V8_COVERAGE: coverage } });
  assert.equal(run.status, 0);
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  const named = path.join(folder, "linked");
  if (throughLink)
    symlinkSync(production, named, "junction");
  const project = throughLink ? named : production;
  const count = await new PackageCoverage(skipsCoveredDetails).measureAsync(coverage, [{ name: "sample", productionDirectory: project, sourceDirectory: project }], output);
  return { text, covered: count.covered, total: count.total };
};

describe("PackageCoverage", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("lists a fully covered file unless the run skips coverage details", async () => {
    const { text, covered, total } = await measureAsync(false);

    assert.match(text, /covered-file\.js/u);
    assert.match(text, /uncovered-file\.js/u);
    assert.deepEqual([covered, total], [1, 2]);
  });

  it("leaves a fully covered file out, and keeps an incomplete one, when the run skips coverage details", async () => {
    const { text, covered, total } = await measureAsync(true);

    assert.doesNotMatch(text, /[^n]covered-file\.js/u);
    assert.match(text, /uncovered-file\.js/u);
    assert.deepEqual([covered, total], [1, 2]);
  });

  it("matches the coverage of a package whose folder it is given through a link, as Node.js records the real path", async () => {
    const { covered, total } = await measureAsync(false, true);

    assert.deepEqual([covered, total], [1, 2]);
  });
});
