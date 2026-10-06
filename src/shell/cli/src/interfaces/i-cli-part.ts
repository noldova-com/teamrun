/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliPartContext } from "./i-cli-part-context.js";

export interface ICliPart {
  activateAsync(context: ICliPartContext): Promise<void>;

  deactivateAsync(): Promise<void>;
}
