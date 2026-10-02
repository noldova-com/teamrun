/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "./i-window-part-context";

export interface IWindowPart {
  readonly moduleId: string;

  activateAsync(context: IWindowPartContext): Promise<void>;
  deactivateAsync(): Promise<void>;
}
