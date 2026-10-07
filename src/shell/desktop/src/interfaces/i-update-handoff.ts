/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateReadyRecord } from "../models/update-ready-record.js";

export interface IUpdateHandoff {
  readonly refusal: string | null;
  handOffAsync(record: UpdateReadyRecord): Promise<number | null>;
  clearAsync(): Promise<void>;
}
