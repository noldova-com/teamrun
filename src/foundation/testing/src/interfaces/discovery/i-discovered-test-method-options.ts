/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestDataRow } from "../../models/discovery/test-data-row.js";

export interface IDiscoveredTestMethodOptions {
  readonly testDataRow?: TestDataRow;
  readonly skipReason?: string;
  readonly categories?: readonly string[];
}
