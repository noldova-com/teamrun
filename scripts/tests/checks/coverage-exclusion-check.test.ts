/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import CoverageExclusionCheck from "../../checks/coverage-exclusion-check.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class CoverageExclusionCheckTests {
  private static readonly TABLE: readonly string[] = [
    "## 5. Coverage requirements",
    "",
    "| Scope | Requirement |",
    "|---|---|",
    "| Foundation packages | 100% of executable production code, with no `exclusion.ts` granted |",
    "| `src/shell/desktop` | 100%, except `main.ts`, which runs only inside Electron; a cell may hold `a \\| b` |",
    "| `src/shell/runtime` | 100% of executable production code |",
    "| `src/shell/desktop` | A second row for the same package adds `utility-entry.ts` to its grants |",
    "",
    "Only this table grants an exclusion."
  ];
  private static readonly UNREADABLE: string = "docs/TESTING.md: section 5's coverage table, headed \"| Scope | Requirement |\", could not be read, so no coverage exclusion can be granted.\n";

  public static register(): void {
    test("exclusions that section 5's table grants to their package pass, across every row for that package, and packages without exclusions need no grant", async t => {
      const repository = await CoverageExclusionCheckTests.createRepositoryAsync(t, CoverageExclusionCheckTests.TABLE.join("\n"), {
        "src/shell/desktop": [{ file: "main.ts", reason: "Electron only." }, { file: "utility-entry.ts", reason: "Electron only." }],
        "src/shell/runtime": [],
        "src/foundation/core": undefined
      });
      const output = new TextOutputFixture();

      const check = CoverageExclusionCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 2 coverage exclusions in 3 packages against docs/TESTING.md section 5.\n");
      assert.equal(check.title, "Coverage exclusions");
    });

    test("an exclusion the table grants to no row, to another package or not at all fails with its package and file", async t => {
      const repository = await CoverageExclusionCheckTests.createRepositoryAsync(t, CoverageExclusionCheckTests.TABLE.join("\n"), {
        "src/shell/desktop": [{ file: "main.ts", reason: "Electron only." }, { file: "window.ts", reason: "Not granted." }],
        "src/shell/runtime": [{ file: "main.ts", reason: "Granted to another package." }],
        "src/foundation/core": [{ file: "exclusion.ts", reason: "Named in a row without a package." }, { reason: "Names no file." }]
      });
      const output = new TextOutputFixture();

      assert.equal(await CoverageExclusionCheckTests.createCheck(repository).runAsync(output), false);
      assert.equal(output.text, [
        ...[["src/foundation/core", "exclusion.ts"], ["src/shell/desktop", "window.ts"], ["src/shell/runtime", "main.ts"]].map(t =>
          `${t[0]}/package.json: excludes ${t[1]} from coverage, which docs/TESTING.md section 5's table does not grant; only that table grants an exclusion.`),
        "Checked 4 coverage exclusions in 3 packages against docs/TESTING.md section 5.",
        ""
      ].join("\n"));
    });

    test("a missing contract, a missing table, a table without rows or a row that is not a whole table row fails without granting anything", async t => {
      const exclusions = { "src/shell/desktop": [{ file: "main.ts", reason: "Electron only." }] };
      const contracts = [
        null,
        "# Testing\n\nNo coverage table here.\n",
        "| Scope | Requirement |\n|---|---|\n\nThe rows are gone.\n",
        "| Scope | Requirement |\n|---|---|\n| `src/shell/desktop` grants `main.ts` without a second cell |\n",
        "| Scope | Requirement |\n|---|---|\n| `src/shell/desktop` | grants `main.ts` without a closing bar\n"
      ];

      for (const contract of contracts) {
        const repository = await CoverageExclusionCheckTests.createRepositoryAsync(t, contract, exclusions);
        const output = new TextOutputFixture();

        assert.equal(await CoverageExclusionCheckTests.createCheck(repository).runAsync(output), false, String(contract));
        assert.equal(output.text, CoverageExclusionCheckTests.UNREADABLE);
      }
    });

    test("packages that cannot be read fail the check with the reason, and other errors are not hidden", async t => {
      const repository = await CoverageExclusionCheckTests.createRepositoryAsync(t, CoverageExclusionCheckTests.TABLE.join("\n"), {});
      await repository.writeAsync({ "src/shell/desktop/package.json": "{}\n" });
      const output = new TextOutputFixture();
      const catalog = new PackageCatalog(repository.directory);
      const failing = new PackageCatalog(repository.directory);
      t.mock.method(failing, "listPackagesAsync", () => Promise.reject(new RangeError("unexpected")));

      assert.equal(await new CoverageExclusionCheck(repository.directory, catalog).runAsync(output), false);
      assert.equal(output.text, "src/shell/desktop/package.json must have a name.\n");
      await assert.rejects(() => new CoverageExclusionCheck(repository.directory, failing).runAsync(new TextOutputFixture()), new RangeError("unexpected"));
    });
  }

  private static async createRepositoryAsync(t: TestContext, contract: string | null, packages: Readonly<Record<string, readonly object[] | undefined>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    const files: Record<string, string> = {};
    if (contract !== null)
      files["docs/TESTING.md"] = `${contract}\n`;
    for (const [directory, exclusions] of Object.entries(packages)) {
      const name = PackageManifest.formatName(directory);
      files[`${directory}/package.json`] = `${JSON.stringify({ name, version: "__VERSION__", ...exclusions === undefined ? {} : { teamrun: { coverageExclusions: exclusions } } })}\n`;
    }
    await repository.writeAsync(files);
    return repository;
  }

  private static createCheck(repository: RepositoryFixture): CoverageExclusionCheck {
    return new CoverageExclusionCheck(repository.directory, new PackageCatalog(repository.directory));
  }
}

CoverageExclusionCheckTests.register();
