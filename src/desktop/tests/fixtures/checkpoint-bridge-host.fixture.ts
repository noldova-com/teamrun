/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { UpdateCheckpoint, UpdateCheckpointResult } from "@noldova/teamrun-protocol";
import { RendererCheckpoint } from "@noldova/teamrun-desktop";

import { FakeBridgeHost } from "./fake-bridge-host.fixture.js";

export class CheckpointBridgeHost extends FakeBridgeHost {
  public ready: boolean = true;
  public readonly checkpoint: RendererCheckpoint = new RendererCheckpoint(this, 2000);

  public override sendToWindow(windowId: number, channel: string, payload: JsonValue): void {
    super.sendToWindow(windowId, channel, payload);
    const request = UpdateCheckpoint.fromJson(payload);
    queueMicrotask(() => this.checkpoint.acknowledge(windowId, new UpdateCheckpointResult(request.id, this.ready)));
  }
}
