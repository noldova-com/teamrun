/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPageProvider } from "./i-page-provider.ts";

export interface ISessionBrowser {
  readonly provider?: IPageProvider;
}
