/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

export interface IDesktopProcess {
  readonly argv: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly platform: string;
  readonly execPath: string;
  readonly homeFolder: string;
  readonly workingDirectory: string;
  readonly isDefaultApp: boolean;
  readonly errorOutput: Writable;
  readonly processId: number;

  startDetached(executablePath: string, args: readonly string[]): void;
  endProcess(processId: number): void;
  onUncaughtError(listener: (error: unknown, origin: string) => void): void;
}
