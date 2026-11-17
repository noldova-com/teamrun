/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShellRun } from "@noldova/ui.components.angular";

export interface IShellRunAt {
  readonly run: ShellRun;
  readonly site: string;
}
