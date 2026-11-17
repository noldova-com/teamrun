/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IComputerUseAppDescription } from "./i-computer-use-app-description.js";

export interface IComputerUseApps {
  describeAsync(identity: string, signal: AbortSignal): Promise<IComputerUseAppDescription | null>;
}
