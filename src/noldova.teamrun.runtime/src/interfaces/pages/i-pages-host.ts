/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolCall } from "@noldova/desktop.runtime";
import type { PageAuthor } from "@noldova/teamrun.protocol";

export interface IPagesHost {
  chatOf(call: ToolCall): string;

  folderOf(call: ToolCall): string;

  authorOf(call: ToolCall): PageAuthor;

  hasChatAsync(chatId: string): Promise<boolean>;
}
