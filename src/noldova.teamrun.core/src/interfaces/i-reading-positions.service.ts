/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConversationPosition, ReadingPositionSaveParams } from "@noldova/teamrun.protocol";

export interface IReadingPositionsService {
  listAsync(): Promise<readonly ConversationPosition[]>;
  saveAsync(params: ReadingPositionSaveParams): Promise<void>;
}
