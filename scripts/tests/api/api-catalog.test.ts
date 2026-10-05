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
import ApiException from "../../api/api.exception.ts";
import BuildLayout from "../../packages/build-layout.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";

class ApiCatalogTests {
  private static readonly SOURCE: Readonly<Record<string, string>> = { "api/index.ts": "export const size: number = 1;\n" };

  public static register(): void {
    test("lists the packages and then the given Angular parts, which share the source project", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writePackageAsync("shapes", ApiCatalogTests.SOURCE, null);
      await fixture.writePartAsync("src/shell/window", ApiCatalogTests.SOURCE, null);

      const found = await ApiCatalogTests.createCatalog(fixture, ["src/shell/window"]).listAsync();

      assert.deepEqual(found.map(t => [t.directory, t.isInstalled]), [["src/foundation/shapes", true], ["src/shell/window", false]]);
      assert.equal(found[1]?.project, path.join(fixture.directory, "src/tsconfig.json"));
    });

    test("without Angular parts lists only the packages and does not read the source project", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      await fixture.writePackageAsync("shapes", ApiCatalogTests.SOURCE, null);

      const found = await ApiCatalogTests.createCatalog(fixture, []).listAsync();

      assert.deepEqual(found.map(t => t.directory), ["src/foundation/shapes"]);
    });

    test("maps a listed part's alias to its declarations, every other alias to its file and any other module to the source project's dependencies", async t => {
      const fixture = await ApiCatalogTests.createAsync(t);
      const aliases = { "@noldova/teamrun-shell-window": ["./shell/window/src/api/index.ts"], "@noldova/teamrun-shell-ui": ["./shell/ui/src/api/index.ts"] };
      await fixture.writeFilesAsync({ "src/tsconfig.json": JSON.stringify({ compilerOptions: { paths: aliases } }) });

      const [found] = await ApiCatalogTests.createCatalog(fixture, ["src/shell/window"]).listAsync();

      assert.deepEqual(found?.paths, {
        "@noldova/teamrun-shell-window": [path.join(fixture.directory, "src/shell/window/src/api/index.d.ts")],
        "@noldova/teamrun-shell-ui": [path.join(fixture.directory, "src/shell/ui/src/api/index.ts")],
        "*": [path.join(fixture.directory, "src/node_modules/*")]
      });
    });

    const invalid: readonly (readonly [string, string, string])[] = [
      ["is not JSON", "{", "could not be read as JSON."],
      ["has no path aliases", "{}", "must map its path aliases to lists of files in compilerOptions.paths."],
      ["maps an alias to a file instead of a list", JSON.stringify({ compilerOptions: { paths: { "@noldova/teamrun-shell-window": "./index.ts" } } }), "must map its path aliases"],
      ["lists a number for an alias", JSON.stringify({ compilerOptions: { paths: { "@noldova/teamrun-shell-window": [1] } } }), "must map its path aliases"],
      ["keeps its aliases in a list", JSON.stringify({ compilerOptions: { paths: [] } }), "must map its path aliases"]
    ];
    for (const [kind, text, expected] of invalid)
      test(`a source project that ${kind} fails with the reason`, async t => {
        const fixture = await ApiCatalogTests.createAsync(t);
        await fixture.writeFilesAsync({ "src/tsconfig.json": text });

        await assert.rejects(ApiCatalogTests.createCatalog(fixture, ["src/shell/window"]).listAsync(), (error: unknown) =>
          error instanceof ApiException && error.message.startsWith(`${path.join(fixture.directory, "src/tsconfig.json")} `) && error.message.includes(expected));
      });
  }

  private static async createAsync(context: TestContext): Promise<ApiPackageFixture> {
    const fixture = await ApiPackageFixture.createAsync();
    context.after(() => fixture.disposeAsync());
    return fixture;
  }

  private static createCatalog(fixture: ApiPackageFixture, parts: readonly string[]): ApiCatalog {
    return new ApiCatalog(fixture.directory, new PackageCatalog(fixture.directory), new BuildLayout(fixture.directory), parts);
  }
}

ApiCatalogTests.register();
