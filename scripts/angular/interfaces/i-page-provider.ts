/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWatchedPage } from "./i-watched-page.ts";

export interface IPageProvider {
  pages?: Map<string, IWatchedPage>;
}
