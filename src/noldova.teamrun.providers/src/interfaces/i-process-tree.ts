/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export interface IProcessTree {
  endTree(processId: number, startedBy: number, ancestorId: number): Promise<boolean>;
  endOwnTree(processId: number, startedBy: number): Promise<boolean>;
  endDescendants(processId: number): Promise<void>;
  endLeftovers(processId: number, launched: number, exited: number): Promise<void>;
}
