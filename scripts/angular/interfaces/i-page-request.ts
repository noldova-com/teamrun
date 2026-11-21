/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRequestFailure } from "./i-request-failure.ts";

export interface IPageRequest {
  url(): string;
  failure(): IRequestFailure | null;
}
