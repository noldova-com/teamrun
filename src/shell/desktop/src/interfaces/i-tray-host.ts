/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITray } from "./i-tray.js";

export interface ITrayHost {
  create(image: string): ITray;
}
