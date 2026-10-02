/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum SessionState {
  AwaitingHandshake = "AwaitingHandshake",
  Authenticated = "Authenticated",
  OtherBuild = "OtherBuild",
  Refused = "Refused",
  Closed = "Closed"
}
