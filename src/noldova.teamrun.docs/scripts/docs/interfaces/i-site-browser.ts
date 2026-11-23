/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISitePage } from "./i-site-page.ts";

export interface ISiteBrowser {
  newPage(): Promise<ISitePage>;
  close(): Promise<void>;
}
