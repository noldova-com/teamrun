/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { UpdateCheckpoint, UpdateCheckpointPhase, type UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import type { IBridgeHost } from "../interfaces/i-bridge-host.js";
import { Resources } from "../resources.js";

export class RendererCheckpoint {
  private readonly host: IBridgeHost;
  private readonly milliseconds: number;
  private id: string | null = null;
  private readonly waiting: Set<number> = new Set();
  private pending: PromiseWithResolvers<boolean> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private ready: boolean = false;

  public constructor(host: IBridgeHost, milliseconds: number = Resources.checkpointTimeoutMilliseconds) {
    this.host = host;
    this.milliseconds = milliseconds;
  }

  public get isPrepared(): boolean {
    return this.ready;
  }

  public get isFrozen(): boolean {
    return !Object.isNull(this.id);
  }

  public prepare(id: string): Promise<boolean> {
    if (this.id === id)
      return this.pending?.promise ?? Promise.resolve(this.ready);
    if (!Object.isNull(this.id))
      return Promise.resolve(false);
    const windows = this.host.windowIds();
    if (windows.length === 0)
      return Promise.resolve(false);
    this.id = id;
    this.pending = Promise.withResolvers<boolean>();
    const promise = this.pending.promise;
    this.ready = false;
    for (const windowId of windows)
      this.waiting.add(windowId);
    this.timer = setTimeout(() => this.resume(id), this.milliseconds);
    for (const windowId of windows)
      this.host.sendToWindow(windowId, Resources.checkpointEventChannel, new UpdateCheckpoint(id, UpdateCheckpointPhase.Prepare).toJson());
    return promise;
  }

  public acknowledge(windowId: number, result: UpdateCheckpointResult): boolean {
    if (result.id !== this.id || !this.waiting.delete(windowId))
      return false;
    if (!result.ready) {
      this.resume(result.id);
      return true;
    }
    if (this.waiting.size === 0) {
      if (!Object.isNull(this.timer))
        clearTimeout(this.timer);
      this.timer = null;
      this.ready = true;
      this.pending?.resolve(true);
      this.pending = null;
    }
    return true;
  }

  public resume(id: string): void {
    if (this.id !== id)
      return;
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.timer = null;
    this.waiting.clear();
    this.ready = false;
    this.id = null;
    this.pending?.resolve(false);
    this.pending = null;
    this.host.broadcast(Resources.checkpointEventChannel, new UpdateCheckpoint(id, UpdateCheckpointPhase.Resume).toJson());
  }

  public dispose(): void {
    if (!Object.isNull(this.id))
      this.resume(this.id);
  }
}
