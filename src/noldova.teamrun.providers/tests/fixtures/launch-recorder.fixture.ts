/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess, SpawnOptions } from "node:child_process";

import { LaunchStart } from "./launch-start.fixture.js";

export class LaunchRecorder {
  public readonly starts: LaunchStart[] = [];
  public readonly children: ChildProcess[] = [];
  public readonly start: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess = (command, args, options) => {
    this.starts.push(new LaunchStart(command, args, options));
    const child = (this.makers[this.starts.length - 1] ?? this.fallback)();
    this.children.push(child);
    return child;
  };
  private readonly makers: readonly (() => ChildProcess)[];
  private readonly fallback: () => ChildProcess;

  public constructor(fallback: () => ChildProcess, makers: readonly (() => ChildProcess)[]) {
    this.fallback = fallback;
    this.makers = makers;
  }
}
