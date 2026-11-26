/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IReadOnlyList } from "@noldova/context.collections";
import { ProcessIdentity, ProcessTree, type ProcessTreeEndOptions } from "@noldova/context.processes";

import type { IContextProcessTree } from "../../interfaces/i-context-process-tree.js";

export class ContextProcessTree implements IContextProcessTree {
  public readAsync(processId: number): Promise<ProcessIdentity | undefined> {
    return ProcessIdentity.readAsync(processId);
  }

  public endAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return ProcessTree.endAsync(root, options);
  }

  public endDescendantsAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return ProcessTree.endDescendantsAsync(root, options);
  }
}
