/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import PackageLayoutCheck from "../../checks/package-layout-check.ts";
import ModuleCatalog from "../../modules/module-catalog.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageLayoutCheckTests {
  private static readonly COMPLETE: readonly string[] = ["src/tsconfig.json", "src/resources.ts", "tests/tsconfig.json"];
  private static readonly RULE: string = "; CODING-STANDARDS.md section 5 puts package.json at the package root, with src/ and tests/ beside it, each with its own tsconfig.json, and resources.ts at the root of src/.";
  private static readonly SUMMARY: string = "packages; test fixture packages follow CODING-STANDARDS.md section 13 instead.";

  public static register(): void {
    test("packages with src/ and tests/, each with its TypeScript configuration, and resources.ts pass, and fixture packages are left out", async t => {
      const repository = await PackageLayoutCheckTests.createRepositoryAsync(t, {
        "src/shell/runtime": PackageLayoutCheckTests.COMPLETE,
        "src/foundation/core": PackageLayoutCheckTests.COMPLETE,
        [`${ModuleCatalog.FIXTURE_FOLDER}/notes/runtime`]: ["src/tsconfig.json"]
      });
      const output = new TextOutputFixture();

      const check = new PackageLayoutCheck(repository.directory, new PackageCatalog(repository.directory));

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, `Checked the layout of 2 ${PackageLayoutCheckTests.SUMMARY}\n`);
      assert.equal(check.title, "Package layout");
    });

    test("a missing configuration, resources.ts or tests/ folder, or a package inside another, fails with the package", async t => {
      const repository = await PackageLayoutCheckTests.createRepositoryAsync(t, {
        "src/shell/runtime": ["src/resources.ts"],
        "src/shell/runtime/src/inner": PackageLayoutCheckTests.COMPLETE,
        "src/foundation/core": ["src/tsconfig.json", "tests/tsconfig.json"]
      });
      const output = new TextOutputFixture();

      assert.equal(await new PackageLayoutCheck(repository.directory, new PackageCatalog(repository.directory)).runAsync(output), false);
      const rule = PackageLayoutCheckTests.RULE;
      assert.equal(output.text, [
        `src/foundation/core: has no src/resources.ts${rule}`,
        `src/shell/runtime: has no src/tsconfig.json${rule}`,
        `src/shell/runtime: has no tests/tsconfig.json${rule}`,
        `src/shell/runtime/src/inner: lies inside the package src/shell/runtime${rule}`,
        `Checked the layout of 3 ${PackageLayoutCheckTests.SUMMARY}`,
        ""
      ].join("\n"));
    });

    test("a package the catalog cannot read fails the check with the reason, and any other error reaches the caller", async t => {
      const repository = await PackageLayoutCheckTests.createRepositoryAsync(t, { "src/shell/runtime": PackageLayoutCheckTests.COMPLETE });
      await repository.writeAsync({ "src/shell/runtime/package.json": `${JSON.stringify({ name: "@noldova/teamrun-other", version: "__VERSION__" })}\n` });
      const output = new TextOutputFixture();
      const failing = new PackageCatalog(repository.directory);
      failing.listPackagesAsync = () => Promise.reject(new Error("unexpected"));

      assert.equal(await new PackageLayoutCheck(repository.directory, new PackageCatalog(repository.directory)).runAsync(output), false);
      assert.equal(output.text, "src/shell/runtime/package.json must be named \"@noldova/teamrun-shell-runtime\", the package's path below src/ joined with hyphens.\n");
      await assert.rejects(new PackageLayoutCheck(repository.directory, failing).runAsync(new TextOutputFixture()), new Error("unexpected"));
    });
  }

  private static async createRepositoryAsync(t: TestContext, packages: Readonly<Record<string, readonly string[]>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    const files: Record<string, string> = {};
    for (const [directory, present] of Object.entries(packages)) {
      const name = PackageManifest.formatName(directory);
      files[`${directory}/package.json`] = `${JSON.stringify({ name, version: "__VERSION__" })}\n`;
      for (const file of present)
        files[`${directory}/${file}`] = "{}\n";
    }
    await repository.writeAsync(files);
    return repository;
  }
}

PackageLayoutCheckTests.register();
