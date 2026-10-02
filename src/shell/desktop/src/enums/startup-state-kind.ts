/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum StartupStateKind {
  Connecting = "Connecting",
  PreShellData = "PreShellData",
  WorkInProgress = "WorkInProgress",
  WaitingForWork = "WaitingForWork",
  NewerBuild = "NewerBuild",
  Failed = "Failed",
  Ready = "Ready"
}
