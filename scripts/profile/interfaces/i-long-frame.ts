/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILongFrameScript } from "./i-long-frame-script.ts";

export interface ILongFrame {
  duration: number;
  blocking: number;
  scripts: ILongFrameScript[];
}
