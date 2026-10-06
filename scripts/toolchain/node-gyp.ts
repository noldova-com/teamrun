/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type ProcessResult from "../processes/process-result.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";

export default class NodeGyp {
  private static readonly NPM_VARIABLE: string = "npm_execpath";
  private static readonly SCRIPT_SEGMENTS: readonly string[] = ["..", "node_modules", "node-gyp", "bin", "node-gyp.js"];
  private static readonly TIMEOUT: number = 600_000;
  private static readonly UNAVAILABLE: string = "npm_execpath is not set; run this through npm, such as npm run build or npm test.";

  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(nodeGypArguments: readonly string[], directory: string): Promise<ProcessResult> {
    const npm = this.environment[NodeGyp.NPM_VARIABLE];
    if (npm === undefined || npm.length === 0)
      throw new ProcessException(NodeGyp.UNAVAILABLE);
    return this.runner.captureAsync(process.execPath, [path.join(path.dirname(npm), ...NodeGyp.SCRIPT_SEGMENTS), ...nodeGypArguments], directory, NodeGyp.TIMEOUT);
  }
}
