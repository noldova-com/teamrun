/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ICodexHold {
  count: number;
  reload: boolean;
  revokes: (() => void)[];
  token: string | null;
  sender: string | null;
  tools: readonly string[] | null;
  mode: string | null;
  model: string | null;
  effort: string | null;
  cwd: string | null;
}
