/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { IBridgeHandlers, IBridgeHost } from "@noldova/teamrun-desktop";

export class FakeBridgeHost implements IBridgeHost {
  public readonly targeted: { windowId: number; channel: string; payload: JsonValue }[] = [];
  public readonly windows: number[] = [1];

  public windowIds(): readonly number[] {
    return this.windows;
  }

  public sendToWindow(windowId: number, channel: string, payload: JsonValue): void {
    this.targeted.push({ windowId, channel, payload });
  }
  public readonly broadcasts: { channel: string; payload: JsonValue }[] = [];
  public readonly openedUrls: string[] = [];
  public readonly titleBars: { color: string; symbolColor: string }[] = [];
  public handlers: IBridgeHandlers | null = null;
  public pickedDirectory: string | null = null;
  public pickCount: number = 0;

  public attach(handlers: IBridgeHandlers): void {
    this.handlers = handlers;
  }

  public broadcast(channel: string, payload: JsonValue): void {
    this.broadcasts.push({ channel, payload });
  }

  public openExternal(url: string): Promise<void> {
    this.openedUrls.push(url);
    return Promise.resolve();
  }

  public setTitleBar(color: string, symbolColor: string): void {
    this.titleBars.push({ color, symbolColor });
  }

  public pickDirectory(): Promise<string | null> {
    this.pickCount += 1;
    return Promise.resolve(this.pickedDirectory);
  }
}
