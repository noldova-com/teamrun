/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import PackageCatalog from "../../packages/package-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import ChangeSelection from "../../workflows/change-selection.ts";
import ChangeSelector from "../../workflows/change-selector.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class ChangeSelectorTests {
  private static readonly PREFIX: string = "@noldova/teamrun-";
  private static readonly RELATIVE_IMPORT: RegExp = /(?:\bfrom |^import )"(\.[^"]+)"/gm;
  private static readonly ANY_IMPORT: RegExp = /(?:\bfrom |^import |\bimport\()["']/m;
  private static readonly PACKAGE_IMPORT: RegExp = /(?:\bfrom |^import )"(@noldova\/teamrun-[a-z-]+)"/gm;
  private static readonly GRAPH: readonly (readonly [string, readonly string[]])[] = [
    ["foundation/core", []],
    ["foundation/exceptions", ["foundation-core"]],
    ["foundation/json", ["foundation-core", "foundation-exceptions"]],
    ["foundation/text", ["foundation-exceptions"]],
    ["foundation/testing", ["foundation-core", "foundation-exceptions", "foundation-text"]],
    ["shell/protocol", ["foundation-core", "foundation-exceptions", "foundation-json"]],
    ["shell/runtime", ["foundation-core", "foundation-exceptions", "foundation-json", "shell-protocol"]],
    ["shell/cli", ["foundation-core", "foundation-exceptions", "foundation-json", "shell-protocol", "shell-runtime"]],
    ["shell/desktop", ["foundation-core", "foundation-exceptions", "foundation-json", "shell-protocol", "shell-runtime"]]
  ];

  public static register(): void {
    test("a package's source change selects it and every package depending on it, the Angular tests when the window depends on one, and every UI workflow", () => {
      const selector = ChangeSelectorTests.createSelector();
      const backwards = new ChangeSelector(ChangeSelectorTests.createPackages().toReversed());

      const protocol = selector.select(["src/shell/protocol/src/models/message.ts"], []);
      const text = backwards.select(["src/foundation/text/src/index.ts", "src/foundation/text/README.md"], []);

      ChangeSelectorTests.assertSelection(protocol, ["shell-protocol", "shell-runtime", "shell-cli", "shell-desktop"], true, false, undefined);
      ChangeSelectorTests.assertSelection(text, ["foundation-testing", "foundation-text"], false, false, undefined);
    });

    test("a package's test change selects its tests and its dependents', whose coverage they share, and no UI workflow", () => {
      const selector = ChangeSelectorTests.createSelector();

      const cli = selector.select(["src/shell/cli/tests/models/command.test.ts"], []);
      const core = selector.select(["src/foundation/core/tests/extensions/string.test.ts"], []);

      ChangeSelectorTests.assertSelection(cli, ["shell-cli"], false, false, []);
      ChangeSelectorTests.assertSelection(core, ChangeSelectorTests.GRAPH.map(([directory]) => directory.replace("/", "-")), false, false, []);
    });

    test("the window and the kit select the Angular tests, and every UI workflow unless only their tests changed", () => {
      const selector = ChangeSelectorTests.createSelector();

      ChangeSelectorTests.assertSelection(selector.select(["src/shell/window/src/app.component.ts"], []), [], true, false, undefined);
      ChangeSelectorTests.assertSelection(selector.select(["src/shell/ui/tests/button.spec.ts"], []), [], true, false, []);
    });

    test("changed UI workflows select only themselves, and the harness and fixture modules select every UI workflow", () => {
      const selector = ChangeSelectorTests.createSelector();
      const menus = "src/shell/desktop/tests/e2e/menus.spec.ts";
      const cli = "src/shell/desktop/tests/e2e/cli.spec.ts";

      ChangeSelectorTests.assertSelection(selector.select([menus, cli], []), [], false, false, [cli, menus]);
      ChangeSelectorTests.assertSelection(selector.select([menus, "src/shell/desktop/tests/e2e/fixtures/desktop-application.fixture.ts"], []), [], false, false, undefined);
      ChangeSelectorTests.assertSelection(selector.select(["src/shell/desktop/tests/e2e/fixtures/modules/clock/runtime/src/index.ts"], []), [], false, false, undefined);
    });

    test("tooling outside the app selects the script tests beside what the app's changes select", () => {
      const selector = ChangeSelectorTests.createSelector();

      ChangeSelectorTests.assertSelection(selector.select([], ["scripts/release/release-publisher.ts", ".github/workflows/nightly.yml"]), [], false, true, []);
      ChangeSelectorTests.assertSelection(selector.select(["src/shell/cli/tests/models/command.test.ts"], [".gitignore"]), ["shell-cli"], false, true, []);
    });

    test("a source file the build scripts import selects the script tests beside its package's", () => {
      const selector = ChangeSelectorTests.createSelector();

      ChangeSelectorTests.assertSelection(selector.select(["src/shell/cli/src/models/command-line-names.ts"], []), ["shell-cli"], false, true, undefined);
    });

    test("whatever the selection cannot narrow selects everything with the reason, wherever it is among the changes", () => {
      const selector = ChangeSelectorTests.createSelector();
      const narrow = "src/shell/cli/tests/models/command.test.ts";
      const cases: readonly (readonly [readonly string[], readonly string[], string])[] = [
        [["package.json"], [], "package.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["src/package-lock.json"], [], "src/package-lock.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [[narrow, "src/shell/cli/package.json"], [], "src/shell/cli/package.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["src/foundation/core/src/tsconfig.json"], [], "src/foundation/core/src/tsconfig.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["tsconfig.base.json"], [], "tsconfig.base.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["src/angular.json"], [], "src/angular.json is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["src/vitest.config.mts"], [], "src/vitest.config.mts is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [["src/shell/desktop/tests/e2e/playwright.config.ts"], [], "src/shell/desktop/tests/e2e/playwright.config.ts is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration."],
        [[narrow], ["scripts/release/release-publisher.ts", "scripts/test.ts"], "scripts/test.ts is part of npm test, which runs every check and test."],
        [[], ["scripts/test-options.ts"], "scripts/test-options.ts is part of npm test, which runs every check and test."],
        [[], ["scripts/test-options.exception.ts"], "scripts/test-options.exception.ts is part of npm test, which runs every check and test."],
        [[], ["scripts/test-part.ts"], "scripts/test-part.ts is part of npm test, which runs every check and test."],
        [[], ["scripts/checks/type-check.ts"], "scripts/checks/type-check.ts is part of npm test, which runs every check and test."],
        [[".github/workflows/build-and-test.yml"], [], ".github/workflows/build-and-test.yml is tooling the app is built or its UI workflows are run with."],
        [[".github/actions/prepare/action.yml"], [], ".github/actions/prepare/action.yml is tooling the app is built or its UI workflows are run with."],
        [[narrow, "scripts/packages/package-build.ts"], [], "scripts/packages/package-build.ts is tooling the app is built or its UI workflows are run with."],
        [["src/generated/product.ts"], [], "src/generated/product.ts belongs to no package, window part, UI workflow or script, so what it affects is unknown."],
        [["assets/fonts/noldova-sans.woff2"], [], "assets/fonts/noldova-sans.woff2 belongs to no package, window part, UI workflow or script, so what it affects is unknown."],
        [["src/modules/checkpoints/runtime/src/index.ts"], [], "src/modules/checkpoints/runtime/src/index.ts belongs to no package, window part, UI workflow or script, so what it affects is unknown."],
        [["src/foundation/testing/tests/runner.test.ts"], [], "src/foundation/testing/tests/runner.test.ts is part of @noldova/teamrun-foundation-testing, which runs every package's tests."]
      ];

      for (const [appPaths, toolingPaths, reason] of cases) {
        const selection = selector.select(appPaths, toolingPaths);

        assert.deepEqual([selection.isEverything, selection.reason], [true, reason], [...appPaths, ...toolingPaths].join(" "));
      }
    });

    test("the window's dependencies are the packages the window and the kit import", async () => {
      const imported = new Set<string>();
      for (const part of ["src/shell/ui", "src/shell/window"]) {
        const directory = path.join(SourceTreeFixture.root, part);
        const files = (await readdir(directory, { recursive: true })).filter(t => t.endsWith(".ts") && !t.split(path.sep).includes("node_modules"));
        for (const file of files)
          for (const match of (await readFile(path.join(directory, file), "utf8")).matchAll(ChangeSelectorTests.PACKAGE_IMPORT))
            imported.add(match[1] ?? "");
      }
      const packages = (await new PackageCatalog(SourceTreeFixture.root).listPackagesAsync(false)).map(t => t.name);

      assert.deepEqual([...imported].filter(t => packages.includes(t)).sort(), ChangeSelector.WINDOW_DEPENDENCIES);
      assert.deepEqual([...imported].filter(t => !packages.includes(t)).sort(), ["@noldova/teamrun-shell-ui", "@noldova/teamrun-shell-window"]);
    });

    test("the script sources are the source files the build scripts import, and they import nothing themselves", async () => {
      const directory = path.join(SourceTreeFixture.root, "scripts");
      const files = (await readdir(directory, { recursive: true })).filter(t => t.endsWith(".ts") && !t.split(path.sep).includes("node_modules"));
      const imported = new Set<string>();
      for (const file of files)
        for (const match of (await readFile(path.join(directory, file), "utf8")).matchAll(ChangeSelectorTests.RELATIVE_IMPORT)) {
          const target = path.relative(SourceTreeFixture.root, path.resolve(path.dirname(path.join(directory, file)), match[1] ?? "")).split(path.sep).join("/");
          if (target.startsWith("src/"))
            imported.add(target);
        }
      const sources = await Promise.all(ChangeSelector.SCRIPT_SOURCES.map(t => readFile(path.join(SourceTreeFixture.root, t), "utf8")));

      assert.deepEqual([...imported].sort(), ChangeSelector.SCRIPT_SOURCES);
      assert.deepEqual(sources.filter(t => ChangeSelectorTests.ANY_IMPORT.test(t)), []);
    });
  }

  private static createPackages(): PackageManifest[] {
    return ChangeSelectorTests.GRAPH.map(([directory, dependencies]) =>
      new PackageManifest(`src/${directory}`, `${ChangeSelectorTests.PREFIX}${directory.replace("/", "-")}`, dependencies.map(t => `${ChangeSelectorTests.PREFIX}${t}`)));
  }

  private static createSelector(): ChangeSelector {
    return new ChangeSelector(ChangeSelectorTests.createPackages());
  }

  private static assertSelection(selection: ChangeSelection, packages: readonly string[], runsAngularTests: boolean, runsScriptTests: boolean, uiWorkflows: readonly string[] | undefined): void {
    assert.deepEqual([selection.isEverything, selection.tests?.packages, selection.tests?.runsAngularTests, selection.tests?.runsScriptTests, selection.uiWorkflows],
      [false, packages.map(t => `${ChangeSelectorTests.PREFIX}${t}`), runsAngularTests, runsScriptTests, uiWorkflows], selection.summary);
  }
}

ChangeSelectorTests.register();
