/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QuitQuestion } from "../models/quit-question.js";

export interface IQuitPrompt {
  show(question: QuitQuestion | null): boolean;
}
