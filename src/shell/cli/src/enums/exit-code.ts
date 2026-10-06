/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum ExitCode {
  Success = 0,
  Failed = 1,
  Usage = 2,
  NoRuntime = 3,
  BuildMismatch = 4,
  DataDirectoryUnusable = 5,
  Stopped = 6,
  ModuleNotActive = 7,
  Updating = 8
}
