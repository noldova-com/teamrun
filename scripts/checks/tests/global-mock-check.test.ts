/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { GlobalMockCheck } from "../global-mock-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";
import type { CheckRun } from "./fixtures/check-run.fixture.ts";

const PACKAGE = "src/noldova.teamrun.sample";
const LISTED = `${PACKAGE}/tests/listed.test.ts`;
const OTHER = `${PACKAGE}/tests/other.test.ts`;
const FILE_SYSTEM_MOCK = "import fs from \"node:fs\";\nimport { mock } from \"node:test\";\nmock.method(fs, \"readSync\");\n";
const PROMISES_MOCK = "import { promises } from \"node:fs\";\nimport { mock } from \"node:test\";\nmock.method(promises, \"cp\");\n";
const TIMERS_MOCK = "import { mock } from \"node:test\";\nmock.timers.enable();\n";
const NO_MOCK = "export const value = 1;\n";

const repositories: CheckRepository[] = [];

const runAsync = async (isolatedTests: readonly string[], sources: Readonly<Record<string, string>>): Promise<CheckRun> => {
  const manifest = JSON.stringify({ name: "@noldova/teamrun.sample", version: "__VERSION__", private: true, noldova: { isolatedTests } });
  const repository = await CheckRepository.createAsync({ [`${PACKAGE}/package.json`]: manifest, ...sources });
  repositories.push(repository);
  return await repository.runAsync(new GlobalMockCheck(repository.root, repository.files));
};

describe("GlobalMockCheck with a package's isolated tests", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("lets a listed test file mock node:fs and its promises, and refuses the same mock in a file that isn't listed", async () => {
    const { passed, lines } = await runAsync(["listed.test.ts"], { [LISTED]: `${FILE_SYSTEM_MOCK}${PROMISES_MOCK}`, [OTHER]: FILE_SYSTEM_MOCK });

    assert.equal(passed, false);
    assert.deepEqual(lines, [`${OTHER}:3: mocks a method of node:fs with mock.method, which every test running alongside it shares`, "Checked 2 test files for global mocks."]);
  });

  it("still refuses a listed test file's mocks of anything but node:fs", async () => {
    const { passed, lines } = await runAsync(["listed.test.ts"], { [LISTED]: `${FILE_SYSTEM_MOCK}${TIMERS_MOCK}` });

    assert.equal(passed, false);
    assert.deepEqual(lines, [`${LISTED}:5: mocks the timers with mock.timers, which every test running alongside it shares`, "Checked 1 test files for global mocks."]);
  });

  it("refuses a listed test file that mocks no node:fs function and a listed file that isn't a test file, so the list can't go stale", async () => {
    const { passed, lines } = await runAsync(["listed.test.ts", "gone.test.ts"], { [LISTED]: NO_MOCK });

    assert.equal(passed, false);
    assert.deepEqual(lines, [
      `${PACKAGE}/tests/gone.test.ts: is listed in its package's isolatedTests, but is no test file`,
      `${LISTED}: is listed in its package's isolatedTests, but mocks no node:fs function`,
      "Checked 1 test files for global mocks."
    ]);
  });

  it("fails with the package's error when its isolated tests aren't a list of paths", async () => {
    const { passed, lines } = await runAsync([], { [`${PACKAGE}/package.json`]: JSON.stringify({ name: "@noldova/teamrun.sample", version: "__VERSION__", private: true,
      noldova: { isolatedTests: "listed.test.ts" } }), [LISTED]: FILE_SYSTEM_MOCK });

    assert.equal(passed, false);
    assert.deepEqual(lines, [`${PACKAGE}/package.json must list its isolated tests as an array of paths under its tests folder.`]);
  });

  it("passes a listed test file that mocks node:fs and nothing else", async () => {
    const { passed, lines } = await runAsync(["listed.test.ts"], { [LISTED]: FILE_SYSTEM_MOCK, [OTHER]: NO_MOCK });

    assert.equal(passed, true);
    assert.deepEqual(lines, ["Checked 2 test files for global mocks."]);
  });
});
