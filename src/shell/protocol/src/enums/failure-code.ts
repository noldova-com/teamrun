/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum FailureCode {
  InvalidMessage = "InvalidMessage",
  FrameTooLarge = "FrameTooLarge",
  UnsupportedVersion = "UnsupportedVersion",
  BuildMismatch = "BuildMismatch",
  PreShellData = "PreShellData",
  Unauthorized = "Unauthorized",
  UnknownMethod = "UnknownMethod",
  InvalidParams = "InvalidParams",
  NotFound = "NotFound",
  Conflict = "Conflict",
  Cancelled = "Cancelled",
  DeadlineExceeded = "DeadlineExceeded",
  Unavailable = "Unavailable",
  Disconnected = "Disconnected",
  Updating = "Updating",
  Internal = "Internal"
}
