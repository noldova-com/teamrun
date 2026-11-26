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
import { ProbeLog } from "./probe-log.js";

export class ContextProcessTree implements IContextProcessTree {
  public readAsync(processId: number): Promise<ProcessIdentity | undefined> {
    return ProbeLog.timed(`context read ${String(processId)}`, () => ProcessIdentity.readAsync(processId));
  }

  public endAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return ProbeLog.timed(`context end ${String(root.processId)}`, () => ProcessTree.endAsync(root, options));
  }

  public endDescendantsAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return ProbeLog.timed(`context endDescendants ${String(root.processId)}`, () => ProcessTree.endDescendantsAsync(root, options));
  }
}
