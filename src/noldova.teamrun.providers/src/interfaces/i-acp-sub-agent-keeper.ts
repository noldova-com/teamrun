/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TurnWake } from "@noldova/teamrun.core";

export interface IAcpSubAgentKeeper {
  readonly cancel: (subAgentId: string) => Promise<boolean>;
  readonly ended: (wake: TurnWake | null) => void;
}
