/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import NodeGyp from "../../toolchain/node-gyp.ts";

export default class NodeGypFixture extends NodeGyp {
  private readonly result: ProcessResult;

  public readonly runs: (readonly string[])[] = [];
  public readonly projects: string[] = [];

  public constructor(result: ProcessResult = new ProcessResult(0, "", "")) {
    super(new ProcessRunner(), {});

    this.result = result;
  }

  public override async runAsync(nodeGypArguments: readonly string[], directory: string): Promise<ProcessResult> {
    this.runs.push([directory, ...nodeGypArguments]);
    const text = await readFile(path.join(directory, "binding.gyp"), "utf8");
    this.projects.push(JSON.stringify(JSON.parse(text)));
    const [target] = (JSON.parse(text) as { targets: { target_name: string; sources: string[] }[] }).targets;
    if (this.result.isSuccessful && target !== undefined) {
      await mkdir(path.join(directory, "build", "Release"), { recursive: true });
      await writeFile(path.join(directory, "build", "Release", `${target.target_name}.node`), `built ${await readFile(path.join(directory, String(target.sources[0])), "utf8")}`);
    }
    return this.result;
  }
}
