/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowsService } from "@noldova/teamrun.core";
import type { PanelAnsweredParams, PanelName, WindowFocusedParams, WindowIdParams } from "@noldova/teamrun.protocol";

export class PageWindows implements IWindowsService {
  public readonly requests: (string | boolean | null)[][] = [];
  private readonly failure: Error | null;

  public constructor(failure: Error | null = null) {
    this.failure = failure;
  }

  public focus(_params: WindowFocusedParams): void {
    throw new Error("The tool sessions don't report windows.");
  }

  public close(_params: WindowIdParams): void {
    throw new Error("The tool sessions don't report windows.");
  }

  public answer(_params: PanelAnsweredParams): void {
    throw new Error("The tool sessions don't answer requests.");
  }

  public reload(_params: WindowIdParams): void {
    throw new Error("The tool sessions don't reload windows.");
  }

  public isShown(_conversationId: string): boolean {
    throw new Error("The tool sessions don't read the shown chats.");
  }

  public onShown(_listener: (conversationId: string) => void): () => void {
    throw new Error("The tool sessions don't follow the shown chats.");
  }

  public requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null): Promise<string> {
    this.requests.push([panel, conversationId, open, callerConversationId]);
    return Object.isNull(this.failure) ? Promise.resolve("w1") : Promise.reject(this.failure);
  }
}
