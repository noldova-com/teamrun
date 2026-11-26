/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IReadOnlyList, List } from "@noldova/context.collections";
import { ProcessesException, ProcessIdentity, ProcessTreeEndException, type ProcessTreeEndOptions } from "@noldova/context.processes";
import type { IContextProcessTree } from "@noldova/teamrun.providers";

export class FailingContextProcessTree implements IContextProcessTree {
  public readonly reads: number[] = [];
  public readonly ends: string[] = [];
  private readonly unreadable: number;

  public constructor(unreadable: number) {
    this.unreadable = unreadable;
  }

  public readAsync(processId: number): Promise<ProcessIdentity | undefined> {
    this.reads.push(processId);
    if (processId === this.unreadable)
      return Promise.reject(new ProcessesException("The lister was not ready."));
    return Promise.resolve(new ProcessIdentity(processId, 1000));
  }

  public endAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return this.fail("tree", root, options);
  }

  public endDescendantsAsync(root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    return this.fail("descendants", root, options);
  }

  private fail(kind: string, root: ProcessIdentity, options: ProcessTreeEndOptions): Promise<IReadOnlyList<ProcessIdentity>> {
    this.ends.push(`${kind} ${String(root.processId)} ${String(options.graceMilliseconds)} ${String(options.limitMilliseconds)}`);
    return Promise.reject(new ProcessTreeEndException(new List([root]), options.limitMilliseconds));
  }
}
