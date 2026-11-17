/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMcpToolHost } from "@noldova/teamrun.protocol";

export interface ITurnToolSession extends IMcpToolHost {
  readonly id: string;
  end(): void;
}
