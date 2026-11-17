/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppLook } from "../models/app-look.js";

export interface IAppDescriptions {
  describeAsync(app: string, signal?: AbortSignal): Promise<AppLook | null>;
}
