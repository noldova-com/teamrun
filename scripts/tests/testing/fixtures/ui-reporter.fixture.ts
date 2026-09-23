/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export default class UiReporterFixture implements Disposable {
  private static readonly ROOT: string = process.cwd();
  private static readonly HEADER: string = "/**\n * @license\n * Copyright (c) Noldova.\n *\n * This source code is licensed under the license found in the\n * LICENSE file in the root directory of this source tree.\n */\n";

  public readonly directory: string = mkdtempSync(path.join(tmpdir(), "teamrun-ui-reporter-"));
  public readonly summaryPath: string = path.join(this.directory, "github-summary.md");
  public readonly environment: NodeJS.ProcessEnv = { ...process.env, GITHUB_STEP_SUMMARY: this.summaryPath };
  public status: number | null = null;
  public stdout: string = "";
  public stderr: string = "";

  public get summary(): string {
    return readFileSync(path.join(this.directory, "_build/ui-results/summary.md"), "utf8");
  }

  public run(source: string, retries: number = 0, maxFailures: number = 0): void {
    const config = path.join(this.directory, "playwright.config.cjs");
    writeFileSync(config, UiReporterFixture.HEADER + "module.exports = " + JSON.stringify({
      testDir: ".", testMatch: "fixture.spec.cjs", outputDir: "_build/ui-results", workers: 1, retries, maxFailures,
      timeout: 1_000, reporter: [["list"], [path.join(UiReporterFixture.ROOT, "scripts/testing/git-hub-ui-reporter.ts")]]
    }));
    writeFileSync(path.join(this.directory, "fixture.spec.cjs"), UiReporterFixture.HEADER +
      "const { test, expect } = require(" + JSON.stringify(path.join(UiReporterFixture.ROOT, "node_modules/@playwright/test")) + ");\n" + source);
    const result = spawnSync(process.execPath, [path.join(UiReporterFixture.ROOT, "node_modules/@playwright/test/cli.js"), "test", "--config", config], {
      cwd: this.directory, env: this.environment, encoding: "utf8", timeout: 20_000, maxBuffer: 1_000_000
    });
    if (result.error)
      throw result.error;
    this.status = result.status;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
  }

  public [Symbol.dispose](): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}
