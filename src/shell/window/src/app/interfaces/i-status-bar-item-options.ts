/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

export interface IStatusBarItemOptions {
  readonly icon?: string;
  readonly tooltip?: string;
  readonly command?: string;
  readonly commandArguments?: JsonValue;
  readonly isHidden?: boolean;
}
