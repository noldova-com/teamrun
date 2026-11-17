/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ConceptFileCheck } from "../concept-file-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const FILE = "src/noldova.teamrun.core/src/services/page-store.ts";
const MANIFEST = "{ \"scripts\": {} }\n";
const CHECKED = "Checked the concepts and file names of 1 production scripts.";

const repositories: CheckRepository[] = [];

const runAsync = async (text: string): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync({ [FILE]: text, "package.json": MANIFEST });
  repositories.push(repository);
  return await repository.runAsync(new ConceptFileCheck(repository.root, repository.files, repository.syntax));
};

describe("ConceptFileCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("passes a file named for its one concept", async () => {
    const { passed, lines } = await runAsync("export class PageStore {}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses a concept outside the file its name gives, at its line", async () => {
    const { passed, lines } = await runAsync("export const version = 1;\nexport class PageReader {}\n");

    assert.deepEqual(lines, [`${FILE}:2: PageReader is not in its file page.reader.ts`, CHECKED]);
    assert.equal(passed, false);
  });

  it("refuses a file that declares two concepts", async () => {
    const { passed, lines } = await runAsync("export class PageStore {}\nexport interface IPage {}\n");

    assert.deepEqual(lines, [`${FILE}: declares 2 concepts, PageStore, IPage`, CHECKED]);
    assert.equal(passed, false);
  });
});
