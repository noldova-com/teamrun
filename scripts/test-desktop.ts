/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Script from "./script.ts";

class TestDesktop extends Script {
  private static readonly COVERAGE_ARGUMENTS: readonly string[] = [
    "--test", "--experimental-test-module-mocks", "--experimental-test-coverage",
    "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100"
  ];

  public override async runAsync(): Promise<void> {
    await this.executeTypeScriptCompilerAsync(["--project", "scripts/tsconfig.json"]);
    await this.executeProcessAsync(process.execPath, [
      ...TestDesktop.COVERAGE_ARGUMENTS, "--test-coverage-include=scripts/desktop.ts", "scripts/tests/desktop.test.ts"
    ], process.cwd());
    await this.executeProcessAsync(process.execPath, [
      ...TestDesktop.COVERAGE_ARGUMENTS, "--test-coverage-include=scripts/desktop/development-binary.ts", "scripts/tests/desktop/development-binary.test.ts"
    ], process.cwd());
  }
}

await new TestDesktop().runAsync();
