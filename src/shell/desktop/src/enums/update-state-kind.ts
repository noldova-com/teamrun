/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum UpdateStateKind {
  Off = "Off",
  UpToDate = "UpToDate",
  Checking = "Checking",
  Available = "Available",
  Downloading = "Downloading",
  Ready = "Ready",
  Failed = "Failed"
}
