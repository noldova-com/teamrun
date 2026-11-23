/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISiteLauncher } from "./i-site-launcher.ts";

export interface IPlaywrightModule {
  readonly default: {
    readonly chromium: ISiteLauncher;
  };
}
