/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

export interface IDialogHost {
  showMessageBox(windowId: number, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
}
