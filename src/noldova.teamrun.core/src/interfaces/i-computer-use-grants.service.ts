/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComputerUseGrant, ComputerUseGrantIdParams } from "@noldova/teamrun.protocol";

export interface IComputerUseGrantsService {
  listAsync(signal?: AbortSignal): Promise<readonly ComputerUseGrant[]>;
  revoke(params: ComputerUseGrantIdParams): void;
  forget(chatIds: readonly string[]): void;
}
