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

import ApiException from "../../api/api.exception.ts";
import ProcessException from "../../processes/process.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ApiCatalogTests {
  private static readonly SOURCE: Readonly<Record<string, string>> = { "api/index.ts": "export const size: number = 1;\n" };

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

    test("maps a listed part's alias to its declarations, every other alias to its file and any other module to the source project's dependencies", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const aliases = { "@noldova/teamrun-shell-window": ["./shell/window/src/api/index.ts"], "@noldova/teamrun-shell-ui": ["./shell/ui/src/api/index.ts"] };
      await fixture.writeFilesAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths: aliases } }) });

      const [found] = await fixture.createCatalog(["src/shell/window"]).listAsync();

      assert.deepEqual(found?.paths, {
        "@noldova/teamrun-shell-window": [path.join(fixture.directory, "src/shell/window/src/api/index.d.ts")],
        "@noldova/teamrun-shell-ui": [path.join(fixture.directory, "src/shell/ui/src/api/index.ts")],
        "*": [path.join(fixture.directory, "src/node_modules/*")]
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

    test("a listing for a check writes a known failure and gives no packages, and lets any other error through", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const output = new TextOutputFixture();

      assert.equal(await fixture.createCatalog(["src/shell/window"]).listOrReportAsync(output), undefined);
      assert.equal(output.text, "The Angular project has no src/tsconfig.json.\n");

      await rm(path.join(fixture.directory, "src"), { recursive: true, force: true });
      await writeFile(path.join(fixture.directory, "src"), "");

      await assert.rejects(fixture.createCatalog([]).listOrReportAsync(output), /ENOTDIR/);
      assert.equal(output.text, "The Angular project has no src/tsconfig.json.\n");
    });
  }

  private static async createAsync(context: TestContext): Promise<ApiPackageFixture> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    return fixture;
  }
}

ApiCatalogTests.register();
