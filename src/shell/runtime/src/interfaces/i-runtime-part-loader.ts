/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart } from "./i-runtime-part.js";

export interface IRuntimePartLoader {
  loadAsync(packageName: string): Promise<IRuntimePart>;
}
