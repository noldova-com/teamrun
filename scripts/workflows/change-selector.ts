/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SelectedTests from "../checks/selected-tests.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import ChangeSelection from "./change-selection.ts";

export default class ChangeSelector {
  public static readonly WINDOW_DEPENDENCIES: readonly string[] = [
    "@noldova/teamrun-foundation-core",
    "@noldova/teamrun-foundation-exceptions",
    "@noldova/teamrun-foundation-json",
    "@noldova/teamrun-shell-protocol"
  ];

  private static readonly TESTING_PACKAGE: string = "@noldova/teamrun-foundation-testing";
  private static readonly SHARED_CONFIGURATION: RegExp = /(?:^|\/)(?:package\.json|package-lock\.json|tsconfig[^/]*\.json|angular\.json|vitest\.config\.[^/]+|playwright\.config\.[^/]+)$/;
  private static readonly TEST_RUNNER_PATHS: readonly string[] = ["scripts/test.ts", "scripts/test-options.ts", "scripts/test-options.exception.ts", "scripts/test-part.ts", "scripts/checks/"];
  private static readonly TOOLING_FOLDERS: readonly string[] = [".github/", "scripts/"];
  private static readonly UI_WORKFLOW_FOLDER: string = "src/shell/desktop/tests/e2e/";
  private static readonly UI_WORKFLOW_PATTERN: RegExp = /^src\/shell\/desktop\/tests\/e2e\/[^/]+\.spec\.ts$/;
  private static readonly WINDOW_FOLDERS: readonly string[] = ["src/shell/ui/", "src/shell/window/"];
  private static readonly TESTS_FOLDER: string = "tests/";

  private readonly packages: readonly PackageManifest[];

  public constructor(packages: readonly PackageManifest[]) {
    this.packages = packages;
  }

  public select(appPaths: readonly string[], toolingPaths: readonly string[]): ChangeSelection {
    const runner = toolingPaths.find(p => ChangeSelector.TEST_RUNNER_PATHS.some(t => p === t || t.endsWith("/") && p.startsWith(t)));
    if (runner !== undefined)
      return ChangeSelection.everything(`${runner} is part of npm test, which runs every check and test.`);

    const changed = new Set<string>();
    const changedSources = new Set<string>();
    const uiWorkflows: string[] = [];
    let runsEveryUiWorkflow = false;
    let runsAngularTests = false;
    for (const changedPath of appPaths) {
      if (ChangeSelector.SHARED_CONFIGURATION.test(changedPath))
        return ChangeSelection.everything(`${changedPath} is shared configuration: a manifest, a lockfile, or TypeScript, Angular, Vitest or Playwright configuration.`);
      if (ChangeSelector.TOOLING_FOLDERS.some(t => changedPath.startsWith(t)))
        return ChangeSelection.everything(`${changedPath} is tooling the app is built or its UI workflows are run with.`);
      if (ChangeSelector.UI_WORKFLOW_PATTERN.test(changedPath)) {
        uiWorkflows.push(changedPath);
        continue;
      }
      if (changedPath.startsWith(ChangeSelector.UI_WORKFLOW_FOLDER)) {
        runsEveryUiWorkflow = true;
        continue;
      }
      const window = ChangeSelector.WINDOW_FOLDERS.find(t => changedPath.startsWith(t));
      if (window !== undefined) {
        runsAngularTests = true;
        runsEveryUiWorkflow ||= !changedPath.startsWith(`${window}${ChangeSelector.TESTS_FOLDER}`);
        continue;
      }
      const owner = this.packages.find(t => changedPath.startsWith(`${t.directory}/`));
      if (owner === undefined)
        return ChangeSelection.everything(`${changedPath} belongs to no package, window part, UI workflow or script, so what it affects is unknown.`);
      if (owner.name === ChangeSelector.TESTING_PACKAGE)
        return ChangeSelection.everything(`${changedPath} is part of ${owner.name}, which runs every package's tests.`);
      changed.add(owner.name);
      if (!changedPath.startsWith(`${owner.directory}/${ChangeSelector.TESTS_FOLDER}`)) {
        changedSources.add(owner.name);
        runsEveryUiWorkflow = true;
      }
    }

    const sourceDependents = this.findDependents(changedSources);
    runsAngularTests ||= ChangeSelector.WINDOW_DEPENDENCIES.some(t => sourceDependents.has(t));
    const selected = this.findDependents(changed);
    const tests = new SelectedTests(this.packages.filter(t => selected.has(t.name)).map(t => t.name), runsAngularTests, toolingPaths.length > 0);
    return ChangeSelection.narrowed(tests, runsEveryUiWorkflow ? undefined : uiWorkflows);
  }

  private findDependents(names: ReadonlySet<string>): ReadonlySet<string> {
    const found = new Set(names);
    let count = 0;
    while (count < found.size) {
      count = found.size;
      for (const manifest of this.packages)
        if (manifest.dependencies.some(t => found.has(t)))
          found.add(manifest.name);
    }
    return found;
  }
}
