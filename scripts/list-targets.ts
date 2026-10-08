/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import BuildMatrix from "./workflows/build-matrix.ts";

export default class ListTargets {
  private static readonly USAGE: string = "Usage: node scripts/list-targets.ts\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly CELL_SEPARATOR: string = "|";
  private static readonly EACH_NIGHT: string = "nightly";
  private static readonly BY_HAND: string = "manual";

  private readonly output: Writable;

  public constructor(output: Writable) {
    this.output = output;
  }

  public run(commandArguments: readonly string[]): number {
    if (commandArguments.length > 0) {
      this.output.write(ListTargets.USAGE);
      return ListTargets.USAGE_EXIT_CODE;
    }
    this.output.write(BuildMatrix.TARGETS.map(t => `${[t.name, t.runner, t.architecture, t.platform, t.packagesEachNight ? ListTargets.EACH_NIGHT : ListTargets.BY_HAND]
      .join(ListTargets.CELL_SEPARATOR)}\n`).join(""));
    return 0;
  }
}

if (import.meta.main)
  process.exitCode = new ListTargets(process.stdout).run(process.argv.slice(2));
