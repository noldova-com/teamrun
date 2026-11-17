/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ConceptFolderCheck } from "../concept-folder-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const FILE = "src/noldova.teamrun.core/src/interfaces/i-page.ts";
const CHECKED = "Checked the folders of 1 production scripts.";

const repositories: CheckRepository[] = [];

const runAsync = async (text: string): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync({ [FILE]: text });
  repositories.push(repository);
  return await repository.runAsync(new ConceptFolderCheck(repository.files, repository.syntax));
};

describe("ConceptFolderCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("passes an interface in interfaces/", async () => {
    const { passed, lines } = await runAsync("export interface IPage {}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses a class in interfaces/, at its line", async () => {
    const { passed, lines } = await runAsync("export const version = 1;\nexport class Page {}\n");

    assert.deepEqual(lines, [`${FILE}:2: Page is in interfaces/ but is not an interface`, CHECKED]);
    assert.equal(passed, false);
  });
});
