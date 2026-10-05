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

import ApiServer from "../../api/api-server.ts";
import ApiDocumentationCheck from "../../checks/api-documentation-check.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ApiDocumentationCheckTests {
  private static readonly TIMEOUT: number = 60_000;
  private static readonly IMPLEMENTATION: Readonly<Record<string, string>> = {
    "api/index.ts": [
      "export class Counter {",
      "  protected step: number = 1;",
      "",
      "  public next(value: number): number {",
      "    return value + this.step;",
      "  }",
      "}",
      ""
    ].join("\n")
  };
  private static readonly DECLARATIONS: string = [
    "/**",
    " * Counts.",
    " */",
    "export declare class Counter {",
    "  protected step: number;",
    "  /**",
    "   * Gives the next value.",
    "   *",
    "   * @param value The current value.",
    "   * @returns The value after it.",
    "   */",
    "  public next(value: number): number;",
    "}",
    ""
  ].join("\n");

  public static register(): void {
    test("a part whose public members are documented passes, and a package fails at its source declarations' line until its protected members are documented too", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePartAsync("src/shell/counter", ApiDocumentationCheckTests.IMPLEMENTATION, ApiDocumentationCheckTests.DECLARATIONS);
      await fixture.writePackageAsync("counter", ApiDocumentationCheckTests.IMPLEMENTATION, ApiDocumentationCheckTests.DECLARATIONS);
      const output = new TextOutputFixture();

      assert.equal(await ApiDocumentationCheckTests.createCheck(fixture, ["src/shell/counter"]).runAsync(output), false);
      assert.equal(output.text, "src/foundation/counter:\n  src/foundation/counter/src/api/index.d.ts:5: Counter#step has no JSDoc\nsrc/shell/counter: documents every public member\n");

      const documented = ApiDocumentationCheckTests.DECLARATIONS.replace("  protected step: number;", "  /**\n   * The step.\n   */\n  protected step: number;");
      await fixture.writePackageAsync("counter", ApiDocumentationCheckTests.IMPLEMENTATION, documented);
      const passed = new TextOutputFixture();

      assert.equal(await ApiDocumentationCheckTests.createCheck(fixture).runAsync(passed), true, passed.text);
      assert.equal(passed.text, "src/foundation/counter: documents every public member\n");
    });

    test("without packages there is nothing to check", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const output = new TextOutputFixture();

      assert.equal(await ApiDocumentationCheckTests.createCheck(fixture).runAsync(output), true);
      assert.equal(output.text, "No packages under src/; there is no API documentation to check.\n");
    });

    test("a listed Angular part without its project or its declarations fails with the reason", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const output = new TextOutputFixture();

      assert.equal(await ApiDocumentationCheckTests.createCheck(fixture, ["src/shell/counter"]).runAsync(output), false);
      assert.equal(output.text, "The Angular project has no src/tsconfig.json.\n");

      await fixture.writePartAsync("src/shell/counter", ApiDocumentationCheckTests.IMPLEMENTATION, null);
      const missing = new TextOutputFixture();

      assert.equal(await ApiDocumentationCheckTests.createCheck(fixture, ["src/shell/counter"]).runAsync(missing), false);
      assert.equal(missing.text, `src/shell/counter:\n  no declarations at ${path.join(fixture.directory, "src/shell/counter/src/api/index.d.ts")}\n`);
    });

    test("a server that cannot start fails the package with the reason", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await fixture.writePackageAsync("counter", ApiDocumentationCheckTests.IMPLEMENTATION, ApiDocumentationCheckTests.DECLARATIONS);
      const output = new TextOutputFixture();
      const check = new ApiDocumentationCheck(fixture.directory, fixture.createCatalog([]), [process.execPath, "-e", "process.exit(3)", "--"],
        ApiDocumentationCheckTests.TIMEOUT);

      assert.equal(await check.runAsync(output), false);
      assert.ok(output.text.includes("The TypeScript API server could not open"), output.text);
    });
  }

  private static createCheck(fixture: ApiPackageFixture, parts: readonly string[] = []): ApiDocumentationCheck {
    return new ApiDocumentationCheck(fixture.directory, fixture.createCatalog(parts), [ApiServer.locateCompiler()], ApiDocumentationCheckTests.TIMEOUT);
  }
}

ApiDocumentationCheckTests.register();
