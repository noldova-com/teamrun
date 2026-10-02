/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rectangle } from "electron";

export interface IDisplayHost {
  getAllDisplays(): readonly { readonly workArea: Rectangle }[];
}
