/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum WireMessageKind {
  Handshake = "Handshake",
  Request = "Request",
  Response = "Response",
  Event = "Event",
  Cancel = "Cancel"
}
