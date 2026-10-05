/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ContentPadding } from "../enums/content-padding";
import type { IWindowPartContext } from "./i-window-part-context";

export interface IWindowPart {
  readonly moduleId: string;
  readonly padding?: ContentPadding;

  activateAsync(context: IWindowPartContext): Promise<void>;
  reconnectAsync(): Promise<boolean>;
  deactivateAsync(): Promise<void>;
}
