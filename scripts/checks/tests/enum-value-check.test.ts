/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { EnumValueCheck } from "../enum-value-check.ts";
import { CheckRepository } from "./fixtures/check-repository.fixture.ts";

const FILE = "src/noldova.teamrun.core/src/enums/page-kind.ts";
const CHECKED = "Checked the enum values of 1 production scripts.";

const repositories: CheckRepository[] = [];

const runAsync = async (text: string): Promise<{ passed: boolean; lines: readonly string[] }> => {
  const repository = await CheckRepository.createAsync({ [FILE]: text });
  repositories.push(repository);
  return await repository.runAsync(new EnumValueCheck(repository.files, repository.syntax));
};

describe("EnumValueCheck", () => {
  afterEach(async () => {
    await Promise.all(repositories.splice(0).map(async t => await t.removeAsync()));
  });

  it("passes a string enum whose values match their names", async () => {
    const { passed, lines } = await runAsync("export enum PageKind {\n  Note = \"Note\",\n  Plan = \"Plan\"\n}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses a member whose value differs from its name, at its line", async () => {
    const { passed, lines } = await runAsync("export enum PageKind {\n  Note = \"Note\",\n  Plan = \"plan\"\n}\n");

    assert.deepEqual(lines, [`${FILE}:3: PageKind.Plan has the value "plan" instead of its name`, CHECKED]);
    assert.equal(passed, false);
  });

  it("passes a member named by a string literal whose value matches it", async () => {
    const { passed, lines } = await runAsync("export enum PageKind {\n  \"Note\" = \"Note\"\n}\n");

    assert.deepEqual(lines, [CHECKED]);
    assert.equal(passed, true);
  });

  it("refuses a member named by a string literal, and one with a template literal value, whose values differ from their names", async () => {
    const { passed, lines } = await runAsync("export enum PageKind {\n  \"Note\" = \"note\",\n  Plan = `plan`\n}\n");

    assert.deepEqual(lines, [`${FILE}:2: PageKind.Note has the value "note" instead of its name`, `${FILE}:3: PageKind.Plan has the value "plan" instead of its name`, CHECKED]);
    assert.equal(passed, false);
  });
});
