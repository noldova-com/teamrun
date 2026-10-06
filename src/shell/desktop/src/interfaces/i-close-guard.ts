/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IQuitPrompt } from "./i-quit-prompt.js";

export interface ICloseGuard {
  canCloseAsync(prompt: IQuitPrompt): Promise<boolean>;
}
