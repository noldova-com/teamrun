/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import RunnerResult from "../../totals/runner-result.ts";
import TotalsException from "../../totals/totals.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class RunnerResultTests {
  private static readonly OUTCOMES: object = {
    passed: 3,
    failed: 1,
    skipped: 1,
    unreached: 1,
    skips: [{ file: "@noldova/teamrun-foundation-alpha/alpha.test.js", names: ["AlphaTests.waits"], reason: "Waits for the shell." }],
    files: ["@noldova/teamrun-foundation-alpha/alpha.test.js"]
  };

  public static register(): void {
    test("a runner's result becomes its totals, naming each skipped test by its file and names", () => {
      const result = RunnerResult.parse(JSON.stringify({ ...RunnerResultTests.OUTCOMES, discovered: 9, selected: 6 }), "result.json");

      const totals = result.toTotals("package", "Package tests", { unit: "blocks", covered: 1, total: 2 });

      assert.deepEqual(JSON.parse(totals.toJson()), {
        version: 1,
        runner: "package",
        title: "Package tests",
        discovered: 9,
        executed: 4,
        passed: 3,
        failed: 1,
        skipped: 1,
        unselected: 3,
        unreached: 1,
        skips: [{ test: "@noldova/teamrun-foundation-alpha/alpha.test.js › AlphaTests.waits", reason: "Waits for the shell." }],
        files: ["@noldova/teamrun-foundation-alpha/alpha.test.js"],
        coverage: { unit: "blocks", covered: 1, total: 2 }
      });
      assert.deepEqual([result.discovered, result.selected], [9, 6]);
    });

    test("a runner that does not filter discovers and selects every test it reports", () => {
      const result = RunnerResult.parse(JSON.stringify(RunnerResultTests.OUTCOMES), "result.json");

      assert.deepEqual([result.discovered, result.selected], [6, 6]);
      assert.equal(result.toTotals("script", "Script tests", null).problem, null);
    });

    test("a result is read from its file, and a missing or malformed one is refused with its path", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/result.json": JSON.stringify(RunnerResultTests.OUTCOMES), "_build/broken.json": JSON.stringify({ ...RunnerResultTests.OUTCOMES, skips: [{ file: "a", names: [1], reason: "b" }] }) });

      const result = await RunnerResult.readAsync(repository.directory, path.join(repository.directory, "_build", "result.json"));

      assert.equal(result.passed, 3);
      await assert.rejects(RunnerResult.readAsync(repository.directory, path.join(repository.directory, "_build", "missing.json")), new TotalsException("The test runner wrote no result to _build/missing.json."));
      await assert.rejects(RunnerResult.readAsync(repository.directory, path.join(repository.directory, "_build", "broken.json")), new TotalsException("_build/broken.json, skips 1, has a list names that is not all text."));
    });
  }
}

RunnerResultTests.register();
