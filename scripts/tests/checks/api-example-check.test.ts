/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ApiCatalog from "../../api/api-catalog.ts";
import ApiServer from "../../api/api-server.ts";
import ApiExampleCheck from "../../checks/api-example-check.ts";
import BuildLayout from "../../packages/build-layout.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ApiExampleCheckTests {
  private static readonly TIMEOUT: number = 60_000;
  private static readonly IMPLEMENTATION: Readonly<Record<string, string>> = {
    "api/index.ts": [
      "export class Counter {",
      "  private value: number;",
      "",
      "  public constructor(start: number) {",
      "    this.value = start;",
      "  }",
      "",
      "  public next(): number {",
      "    return ++this.value;",
      "  }",
      "}",
      "",
      "export function double(value: number): number {",
      "  return value * 2;",
      "}",
      "",
      "export type Unit = \"cm\";",
      ""
    ].join("\n")
  };
  private static readonly DECLARATIONS: string = [
    "export declare class Counter {",
    "  /**",
    "   * Starts counting.",
    "   *",
    "   * @example",
    "   * ```ts",
    "   * import { Counter } from \"@noldova/teamrun-foundation-counter\";",
    "   *",
    "   * new Counter(1).next();",
    "   * ```",
    "   */",
    "  public constructor(start: number);",
    "  /**",
    "   * Counts one more.",
    "   *",
    "   * @example",
    "   * ```ts",
    "   * import { Counter } from \"@noldova/teamrun-foundation-counter\";",
    "   *",
    "   * const counter = new Counter(1);",
    "   * counter.next();",
    "   * ```",
    "   * @example",
    "   * ```ts",
    "   * import { Counter } from \"@noldova/teamrun-foundation-counter\";",
    "   *",
    "   * // @ts-expect-error",
    "   * new Counter(1).next(\"twice\");",
    "   * ```",
    "   */",
    "  public next(): number;",
    "}",
    "/**",
    " * Doubles a number.",
    " *",
    " * @example",
    " * ```ts",
    " * import { double } from \"@noldova/teamrun-foundation-counter\";",
    " *",
    " * double(2);",
    " * ```",
    " */",
    "export declare function double(value: number): number;",
    "export type Unit = \"cm\";",
    ""
  ].join("\n");

  public static register(): void {
    test("a tree without packages passes and says there is nothing to compile", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const output = new TextOutputFixture();
      const check = ApiExampleCheckTests.createCheck(fixture);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "No packages under src/; there are no API examples to compile.\n");
      assert.equal(check.title, "API examples");
    });

    test("examples that compile, and expected errors that occur, pass", async t => {
      assert.equal(await ApiExampleCheckTests.runAsync(t, ApiExampleCheckTests.DECLARATIONS, true), "src/foundation/counter: every example compiles\n");
    });

    test("a package without callables has no examples to compile and passes", async t => {
      assert.equal(await ApiExampleCheckTests.runAsync(t, "export type Unit = \"cm\";\n", true), "src/foundation/counter: every example compiles\n");
    });

    test("a callable without an @example fails", async t => {
      const declarations = ApiExampleCheckTests.DECLARATIONS.replace(/\/\*\*\n \* Doubles[\s\S]*? \*\/\n/, "");
      const output = await ApiExampleCheckTests.runAsync(t, declarations, false);

      assert.equal(output, "src/foundation/counter:\n  double has no @example\n");
    });

    test("an example that does not compile fails with its owner, number and line", async t => {
      const output = await ApiExampleCheckTests.runAsync(t, ApiExampleCheckTests.DECLARATIONS.replace("double(2);", "double(\"2\");"), false);

      assert.ok(output.includes("  the compiler exited with code 1\n"), output);
      assert.ok(output.includes("  double example 1, line 3: error TS2345: "), output);
    });

    test("the continuation lines of a compiler message are kept as written", async t => {
      const broken = "const twice: (value: string) => number = double;\n * twice(\"2\");";
      const output = await ApiExampleCheckTests.runAsync(t, ApiExampleCheckTests.DECLARATIONS.replace("double(2);", broken), false);

      assert.ok(output.includes("  double example 1, line 3: error TS2322: "), output);
      assert.ok(output.includes("\n    Types of parameters 'value' and 'value' are incompatible.\n"), output);
    });

    test("an example on a declaration that is not callable is compiled too", async t => {
      const example = [
        "/**",
        " * Counts.",
        " *",
        " * @example",
        " * ```ts",
        " * import { Counter } from \"@noldova/teamrun-foundation-counter\";",
        " *",
        " * new Counter(\"one\");",
        " * ```",
        " */",
        ""
      ].join("\n");
      const output = await ApiExampleCheckTests.runAsync(t, `${example}${ApiExampleCheckTests.DECLARATIONS}`, false);

      assert.ok(output.includes("  Counter example 1, line 3: error TS2345: "), output);
    });

    test("an expected-error example that compiles fails", async t => {
      const output = await ApiExampleCheckTests.runAsync(t, ApiExampleCheckTests.DECLARATIONS.replace("next(\"twice\");", "next();"), false);

      assert.ok(output.includes("  Counter#next example 2, line 3: error TS2578: Unused '@ts-expect-error' directive."), output);
    });

    test("an error outside the examples is reported as the compiler wrote it", async t => {
      const output = await ApiExampleCheckTests.runAsync(t, `${ApiExampleCheckTests.DECLARATIONS}export declare const broken: Missing;\n`, false);

      assert.ok(/ {2}.*index\.d\.ts\(\d+,\d+\): error TS2304: Cannot find name 'Missing'\./.test(output), output);
    });

    test("an example that is not a fenced TypeScript block fails", async t => {
      const output = await ApiExampleCheckTests.runAsync(t, ApiExampleCheckTests.DECLARATIONS.replace(" * ```ts\n * import { double }", " * import { double }"), false);

      assert.equal(output, "src/foundation/counter:\n  An @example of double must start with a ```ts code block on its next line.\n");
    });

    test("an Angular part's examples compile against its declarations in source and the source project's dependencies", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const declarations = [
        "/**",
        " * Doubles a length.",
        " *",
        " * @example",
        " * ```ts",
        " * import { double } from \"@noldova/teamrun-shell-counter\";",
        " * import type { Length } from \"@noldova/teamrun-fixture-units\";",
        " *",
        " * const length: Length = double(2);",
        " * ```",
        " */",
        "export declare function double(value: number): number;",
        ""
      ].join("\n");
      await fixture.writePartAsync("src/shell/counter", { "api/index.ts": "export const unused: number = 0;\n" }, declarations);
      await fixture.writeFilesAsync({
        "src/node_modules/@noldova/teamrun-fixture-units/package.json": JSON.stringify({ name: "@noldova/teamrun-fixture-units", exports: { ".": { types: "./types/units.d.ts" } }, typings: "./types/units.d.ts" }),
        "src/node_modules/@noldova/teamrun-fixture-units/types/units.d.ts": "export type Length = number;\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await ApiExampleCheckTests.createCheck(fixture, ["src/shell/counter"]).runAsync(output), true, output.text);
      assert.equal(output.text, "src/shell/counter: every example compiles\n");
    });

    test("an Angular part without declarations fails and names the missing file", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePartAsync("src/shell/counter", ApiExampleCheckTests.IMPLEMENTATION, null);
      const output = new TextOutputFixture();

      assert.equal(await ApiExampleCheckTests.createCheck(fixture, ["src/shell/counter"]).runAsync(output), false);
      assert.equal(output.text, `src/shell/counter:\n  no declarations at ${path.join(fixture.directory, "src/shell/counter/src/api/index.d.ts")}\n`);
    });

    test("a package without installed declarations fails and asks for a build", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePackageAsync("counter", ApiExampleCheckTests.IMPLEMENTATION, null);
      const output = new TextOutputFixture();

      assert.equal(await ApiExampleCheckTests.createCheck(fixture).runAsync(output), false);
      assert.ok(output.text.includes("; build the packages first\n"), output.text);
    });
  }

  private static createCheck(fixture: ApiPackageFixture, parts: readonly string[] = []): ApiExampleCheck {
    return new ApiExampleCheck(fixture.directory, new ApiCatalog(fixture.directory, new PackageCatalog(fixture.directory), new BuildLayout(fixture.directory), parts), new ProcessRunner(),
      [ApiServer.locateCompiler()], ApiExampleCheckTests.TIMEOUT);
  }

  private static async runAsync(context: TestContext, declarations: string, expected: boolean): Promise<string> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    await fixture.writePackageAsync("counter", ApiExampleCheckTests.IMPLEMENTATION, declarations);
    const output = new TextOutputFixture();

    assert.equal(await ApiExampleCheckTests.createCheck(fixture).runAsync(output), expected, output.text);
    return output.text;
  }
}

ApiExampleCheckTests.register();
