/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { StopPolicy } from "@noldova/teamrun-shell-protocol";

import type { IQuitPrompt } from "./i-quit-prompt.js";

export interface IQuitHost {
  isExiting(): boolean;
  keepsRunningWithoutWindows(): boolean;
  isLast(prompt: IQuitPrompt): boolean;
  closeToBackground(): void;
  saveAllAsync(): Promise<boolean>;
  stopAsync(policy: StopPolicy): Promise<boolean>;
  findPromptAsync(): Promise<IQuitPrompt | null>;
  quit(): void;
  exit(): void;
}
