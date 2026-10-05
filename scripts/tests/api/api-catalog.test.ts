/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import type ApiPackage from "../../api/api-package.ts";
import ApiException from "../../api/api.exception.ts";
import ProcessException from "../../processes/process.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ApiCatalogTests {
  private static readonly SOURCE: Readonly<Record<string, string>> = { "api/index.ts": "export const size: number = 1;\n" };
  private static readonly NOTHING: string = "No packages.\n";
  private static readonly VERDICT: string = "is fine";

  public static register(): void {
    test("lists the packages and then the given Angular parts, which share the source project", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writePackageAsync("shapes", ApiCatalogTests.SOURCE, null);
      await fixture.writePartAsync("src/shell/window", ApiCatalogTests.SOURCE, null);

      const found = await fixture.createCatalog(["src/shell/window"]).listAsync();

      assert.deepEqual(found.map(t => [t.directory, t.paths === undefined]), [["src/foundation/shapes", true], ["src/shell/window", false]]);
      assert.equal(found[1]?.project, path.join(fixture.directory, "src/tsconfig.json"));
    });

    test("without Angular parts lists only the packages and does not read the source project", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writePackageAsync("shapes", ApiCatalogTests.SOURCE, null);
      await fixture.writeFilesAsync({ "src/tsconfig.json": "{" });

      const found = await fixture.createCatalog([]).listAsync();

      assert.deepEqual(found.map(t => t.directory), ["src/foundation/shapes"]);
    });

    test("maps a listed part's alias to its declarations, and every other alias to its file", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const aliases = { "@noldova/teamrun-shell-window": ["./shell/window/src/api/index.ts"], "@noldova/teamrun-shell-ui": ["./shell/ui/src/api/index.ts"] };
      await fixture.writeFilesAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths: aliases } }) });

      const [found] = await fixture.createCatalog(["src/shell/window"]).listAsync();

      assert.deepEqual(found?.paths, {
        "@noldova/teamrun-shell-window": [path.join(fixture.directory, "src/shell/window/src/api/index.d.ts")],
        "@noldova/teamrun-shell-ui": [path.join(fixture.directory, "src/shell/ui/src/api/index.ts")]
      });
    });

    test("a listed part that no alias leads to fails, since its examples would compile against its implementation", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writeFilesAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@noldova/teamrun-shell-window": ["./shell/frame/src/api/index.ts"] } } }) });

      await assert.rejects(fixture.createCatalog(["src/shell/window"]).listAsync(), new ApiException(
        "No path alias in src/tsconfig.json leads to src/shell/window/src/api/index.ts, so the examples of src/shell/window cannot be compiled against its declarations."));
    });

    test("a listed part without the source project, or with one that cannot be read, fails with the reason", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);

      await assert.rejects(fixture.createCatalog(["src/shell/window"]).listAsync(), new ProcessException("The Angular project has no src/tsconfig.json."));

      await fixture.writeFilesAsync({ "src/tsconfig.json": "{}" });

      await assert.rejects(fixture.createCatalog(["src/shell/window"]).listAsync(), new ProcessException("src/tsconfig.json must map its path aliases to lists of files in compilerOptions.paths."));
    });

    test("a check over the packages writes a known listing failure and inspects nothing, and lets any other error through", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const output = new TextOutputFixture();
      const inspected: string[] = [];
      const inspectAsync = (apiPackage: ApiPackage): Promise<readonly string[]> => {
        inspected.push(apiPackage.directory);
        return Promise.resolve([]);
      };

      assert.equal(await fixture.createCatalog(["src/shell/window"]).inspectEachAsync(output, ApiCatalogTests.NOTHING, ApiCatalogTests.VERDICT, inspectAsync), false);
      assert.deepEqual([output.text, inspected], ["The Angular project has no src/tsconfig.json.\n", []]);

      await rm(path.join(fixture.directory, "src"), { recursive: true, force: true });
      await writeFile(path.join(fixture.directory, "src"), "");

      await assert.rejects(fixture.createCatalog([]).inspectEachAsync(output, ApiCatalogTests.NOTHING, ApiCatalogTests.VERDICT, inspectAsync), /ENOTDIR/);
      assert.deepEqual([output.text, inspected], ["The Angular project has no src/tsconfig.json.\n", []]);
    });

    test("a check over no packages says so and passes", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const output = new TextOutputFixture();

      const passed = await fixture.createCatalog([]).inspectEachAsync(output, ApiCatalogTests.NOTHING, ApiCatalogTests.VERDICT, () => Promise.resolve(["never inspected"]));

      assert.deepEqual([passed, output.text], [true, ApiCatalogTests.NOTHING]);
    });

    test("a check over the packages gives each its verdict or its indented problems, and passes only when none has a problem", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writePackageAsync("lines", ApiCatalogTests.SOURCE, null);
      await fixture.writePackageAsync("shapes", ApiCatalogTests.SOURCE, null);
      const catalog = fixture.createCatalog([]);
      const failing = new TextOutputFixture();
      const passing = new TextOutputFixture();

      const failed = await catalog.inspectEachAsync(failing, ApiCatalogTests.NOTHING, ApiCatalogTests.VERDICT,
        t => Promise.resolve(t.directory.endsWith("shapes") ? ["index.d.ts:3: Shape has no JSDoc", "index.d.ts:5: Shape#area has no JSDoc"] : []));
      const passed = await catalog.inspectEachAsync(passing, ApiCatalogTests.NOTHING, ApiCatalogTests.VERDICT, () => Promise.resolve([]));

      assert.deepEqual([failed, failing.text], [false, [
        "src/foundation/lines: is fine",
        "src/foundation/shapes:",
        "  index.d.ts:3: Shape has no JSDoc",
        "  index.d.ts:5: Shape#area has no JSDoc",
        ""
      ].join("\n")]);
      assert.deepEqual([passed, passing.text], [true, "src/foundation/lines: is fine\nsrc/foundation/shapes: is fine\n"]);
    });
  }

  private static async createAsync(context: TestContext): Promise<ApiPackageFixture> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    return fixture;
  }
}

ApiCatalogTests.register();
