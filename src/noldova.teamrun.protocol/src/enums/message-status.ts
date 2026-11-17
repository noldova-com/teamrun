/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum MessageStatus {
  Pending = "Pending",
  Running = "Running",
  AwaitingApproval = "AwaitingApproval",
  Completed = "Completed",
  Failed = "Failed",
  Cancelled = "Cancelled",
  Interrupted = "Interrupted"
}
