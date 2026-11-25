/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IOriginalPosition } from "./i-original-position.ts";
import type { ISourcePosition } from "./i-source-position.ts";

export interface ISourceMap {
  originalPositionFor(position: ISourcePosition): IOriginalPosition;
}
