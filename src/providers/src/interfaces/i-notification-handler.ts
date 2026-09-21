/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/teamrun-foundation-json";

export interface INotificationHandler {
  handleNotification(method: string, params: JsonReader): void;
}
