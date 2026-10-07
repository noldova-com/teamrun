/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { IProgramHost } from "./i-program-host.js";

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
  readonly programs: IProgramHost;
  readonly isTerminal: boolean;

  startDetached(executablePath: string, args: readonly string[], onFailure: (error: Error) => void): void;
  startDetachedAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void>;
  startApartAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv): Promise<void>;
  endProcess(processId: number): void;
  onUncaughtException(listener: (error: unknown) => void): void;
  onUnhandledRejection(listener: (reason: unknown) => void): void;
}
