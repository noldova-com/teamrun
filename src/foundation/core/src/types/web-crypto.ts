/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IHostRandomSource } from "../interfaces/i-host-random-source.js";

declare global {
  const crypto: IHostRandomSource;
}

export {};
