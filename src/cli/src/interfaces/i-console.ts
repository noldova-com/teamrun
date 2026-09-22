/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IConsole {
  write(line: string): void;
  writeError(line: string): void;
  ask(prompt: string, signal?: AbortSignal): Promise<string | null>;
}
