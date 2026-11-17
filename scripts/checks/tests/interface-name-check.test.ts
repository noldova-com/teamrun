/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { InterfaceNameCheck } from "../interface-name-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const FILE = "src/noldova.teamrun.core/src/interfaces/i-page.ts";
const CHECKED = "Checked the interface names of 1 scripts.";

const repositories: CheckRepository[] = [];

const runAsync = async (text: string): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync({ [FILE]: text });
  repositories.push(repository);
  return await repository.runAsync(new InterfaceNameCheck(repository.files, repository.syntax));
};

describe("InterfaceNameCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("passes an I-prefixed interface and an augmented global one", async () => {
    const { passed, lines } = await runAsync("export interface IPage {}\ndeclare global {\n  interface Window {}\n}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses an interface without the prefix, at its line", async () => {
    const { passed, lines } = await runAsync("export const version = 1;\nexport interface Page {}\n");

    assert.deepEqual(lines, [`${FILE}:2: the interface Page does not start with I and a capital letter`, CHECKED]);
    assert.equal(passed, false);
  });

  it("passes an interface that augments a module, whatever its name", async () => {
    const { passed, lines } = await runAsync("declare module \"@noldova/context.core\" {\n  interface Page {}\n}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });
});
