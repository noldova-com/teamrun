/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PanelAnsweredParams, PanelName, WindowFocusedParams, WindowIdParams } from "@noldova/teamrun.protocol";

export interface IWindowsService {
  focus(params: WindowFocusedParams): void;
  close(params: WindowIdParams): void;
  answer(params: PanelAnsweredParams): void;
  reload(params: WindowIdParams): void;
  isShown(conversationId: string): boolean;
  onShown(listener: (conversationId: string) => void): () => void;
  requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null, signal?: AbortSignal): Promise<string>;
}
