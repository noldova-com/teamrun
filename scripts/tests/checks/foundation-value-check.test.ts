/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import FoundationValueCheck from "../../checks/foundation-value-check.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class FoundationValueCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly RUNTIME: string = "src/shell/runtime/src";
  private static readonly RULE: string = "; CODING-STANDARDS.md section 3 has production packages use foundation's Object and String value checks and String.empty, importing @noldova/teamrun-foundation-core; foundation's core implements them natively.";

  public static register(): void {
    test("foundation's value checks pass, and the foundation Core, tests, declarations and code outside packages are left out", async t => {
      const runtime = FoundationValueCheckTests.RUNTIME;
      const repository = await FoundationValueCheckTests.createRepositoryAsync(t, {
        [`${runtime}/clock.ts`]: [
          "import type { Writable } from \"node:stream\";",
          "",
          "import \"@noldova/teamrun-foundation-core\";",
          "",
          "export class Clock {",
          "  public static readonly zero: string = String.empty;",
          "  public static readonly note: string = \"value === undefined\";",
          "  public static isEmpty(value: string | undefined): value is \"\" | undefined {",
          "    return Object.isUndefined(value) || value.length === 0;",
          "  }",
          "}",
          ""
        ].join("\n"),
        [`${runtime}/named.ts`]: "import { nameof } from \"@noldova/teamrun-foundation-core\";\n\nexport const empty = String.isNullOrWhitespace(nameof);\n",
        [`${runtime}/plain.ts`]: "export const one = Math.max(1, 2);\nexport const same = one === 2 && Object.keys({}).length < 1 && String.raw`a` !== this.value.text;\n",
        [`${runtime}/types.d.ts`]: "export declare const empty: \"\";\nexport const none = \"\";\n",
        "src/shell/runtime/tests/clock.test.ts": "export const none = \"\" === String(undefined);\n",
        "src/foundation/core/src/object.ts": "export const is = (value: unknown) => value === undefined || typeof value === \"string\" || value === \"\";\n",
        "src/shell/window/src/app/view.ts": "export const none = \"\";\n",
        "scripts/build.ts": "export const none = \"\";\n"
      });
      const output = new TextOutputFixture();

      const check = FoundationValueCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the value checks of 3 production scripts in 1 packages.\n");
      assert.equal(check.title, "Foundation value checks");
    });

    test("native null, undefined and typeof comparisons, empty string literals and a missing foundation Core import fail with where they are", async t => {
      const runtime = FoundationValueCheckTests.RUNTIME;
      const repository = await FoundationValueCheckTests.createRepositoryAsync(t, {
        [`${runtime}/checks.ts`]: [
          "export const a = (value: unknown) => value === undefined;",
          "export const b = (value: unknown) => null !== value;",
          "export const c = (value: unknown) => typeof value == \"string\";",
          "export const d = \"\";",
          "export const e = ``;",
          "export const f = (value: unknown) => value != null && Object.isNull(value);",
          ""
        ].join("\n"),
        [`${runtime}/typed.ts`]: "import type { Nameof } from \"@noldova/teamrun-foundation-core\";\n\nexport const empty = String.empty;\n",
        [`${runtime}/elsewhere.ts`]: "import \"@noldova/teamrun-foundation-json\";\n\nexport const empty = (value: string) => String.isNullOrEmpty(value);\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await FoundationValueCheckTests.createCheck(repository).runAsync(output), false);
      const rule = FoundationValueCheckTests.RULE;
      const missing = `uses foundation's value checks without importing @noldova/teamrun-foundation-core${rule}`;
      assert.equal(output.text, [
        `${runtime}/checks.ts:1: value === undefined compares with undefined natively${rule}`,
        `${runtime}/checks.ts:2: null !== value compares with null natively${rule}`,
        `${runtime}/checks.ts:3: typeof value == "string" compares a typeof result${rule}`,
        `${runtime}/checks.ts:4: "" is an empty string literal${rule}`,
        `${runtime}/checks.ts:5: \`\` is an empty string literal${rule}`,
        `${runtime}/checks.ts:6: value != null compares with null natively${rule}`,
        `${runtime}/checks.ts: ${missing}`,
        `${runtime}/elsewhere.ts: ${missing}`,
        `${runtime}/typed.ts: ${missing}`,
        "Checked the value checks of 3 production scripts in 1 packages.",
        ""
      ].join("\n"));
    });

    test("a package the catalog cannot read or a TypeScript API that cannot start fails the check with the reason, and any other error reaches the caller", async t => {
      const file = `${FoundationValueCheckTests.RUNTIME}/clock.ts`;
      const repository = await FoundationValueCheckTests.createRepositoryAsync(t, { [file]: "export const zero = 0;\n" });
      const directory = repository.directory;
      const files = new RepositoryFiles(directory, new Git(directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(directory, [process.execPath, "-e", "process.exit(3)", "--"], FoundationValueCheckTests.TIMEOUT);
      const output = new TextOutputFixture();

      assert.equal(await new FoundationValueCheck(files, new PackageCatalog(directory), stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the value checks of 1 production scripts in 1 packages\.\n$/);

      const failing = new PackageCatalog(directory);
      failing.listPackagesAsync = () => Promise.reject(new Error("unexpected"));
      await assert.rejects(new FoundationValueCheck(files, failing, stopping).runAsync(new TextOutputFixture()), new Error("unexpected"));

      await repository.writeAsync({ "src/shell/runtime/package.json": `${JSON.stringify({ name: "@noldova/teamrun-other", version: "__VERSION__" })}\n` });
      const misnamed = new TextOutputFixture();
      assert.equal(await FoundationValueCheckTests.createCheck(repository).runAsync(misnamed), false);
      assert.equal(misnamed.text, "src/shell/runtime/package.json must be named \"@noldova/teamrun-shell-runtime\", the package's path below src/ joined with hyphens.\n");

      const other = await FoundationValueCheckTests.createRepositoryAsync(t, { [file]: "export const zero = 0;\n", "_build": "a file where the build folder belongs\n" });
      await assert.rejects(FoundationValueCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static async createRepositoryAsync(t: TestContext, files: Readonly<Record<string, string>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "src/shell/runtime/package.json": `${JSON.stringify({ name: "@noldova/teamrun-shell-runtime", version: "__VERSION__" })}\n`,
      "src/foundation/core/package.json": `${JSON.stringify({ name: "@noldova/teamrun-foundation-core", version: "__VERSION__" })}\n`,
      ...files
    });
    return repository;
  }

  private static createCheck(repository: RepositoryFixture): FoundationValueCheck {
    const directory = repository.directory;
    return new FoundationValueCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new PackageCatalog(directory), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], FoundationValueCheckTests.TIMEOUT));
  }
}

FoundationValueCheckTests.register();
