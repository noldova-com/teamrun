/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IAcpTerminalExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
}
