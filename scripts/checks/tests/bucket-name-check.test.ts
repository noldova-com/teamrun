/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { BucketNameCheck } from "../bucket-name-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const FILE = "src/noldova.teamrun.core/src/services/page-store.ts";
const CHECKED = "Checked the paths of 1 files and the types of 1 scripts for bucket names.";

const repositories: CheckRepository[] = [];

const runAsync = async (text: string): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync({ [FILE]: text });
  repositories.push(repository);
  return await repository.runAsync(new BucketNameCheck(repository.files, repository.syntax));
};

describe("BucketNameCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("passes a type named for its concept", async () => {
    const { passed, lines } = await runAsync("export class PageStore {}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses a type whose last word is a bucket, at its line", async () => {
    const { passed, lines } = await runAsync("export const version = 1;\nexport class PageHelper {}\n");

    assert.deepEqual(lines, [`${FILE}:2: the name PageHelper ends in a bucket word`, CHECKED]);
    assert.equal(passed, false);
  });

  for (const [kind, name, text] of [
    ["an interface", "PageUtils", "export interface PageUtils {}\n"],
    ["a type alias", "PageHelpers", "export type PageHelpers = string;\n"],
    ["an enum", "PageCommon", "export enum PageCommon {\n  Note = \"Note\"\n}\n"],
    ["an export's alias", "PageMisc", "export { version as PageMisc };\n"],
    ["a class expression", "PageShared", "export const store = class PageShared {};\n"]
  ] as const) {
    it(`refuses ${kind} whose last word is a bucket, at its line`, async () => {
      const { passed, lines } = await runAsync(`export const version = 1;\n${text}`);

      assert.deepEqual(lines, [`${FILE}:2: the name ${name} ends in a bucket word`, CHECKED]);
      assert.equal(passed, false);
    });
  }
});
