/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Migration } from "../models/migration.js";
import type { IRuntimePartContext } from "./runtime-part-context.js";

export interface IRuntimePart {
  readonly migrations?: readonly Migration[];

  activateAsync(context: IRuntimePartContext): Promise<void>;

  deactivateAsync(): Promise<void>;
}
