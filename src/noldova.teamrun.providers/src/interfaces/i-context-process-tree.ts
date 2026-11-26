/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IReadOnlyList } from "@noldova/context.collections";
import type { ProcessIdentity, ProcessTreeEndOptions } from "@noldova/context.processes";

export interface IContextProcessTree {
  readAsync(processId: number): Promise<ProcessIdentity | undefined>;
  endAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>>;
  endDescendantsAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>>;
}
