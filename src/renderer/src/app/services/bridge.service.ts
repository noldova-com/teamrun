/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, InjectionToken, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { AppUpdateCommand, AppUpdateState, Event, Request, Response, UpdateCheckpoint, UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import { BridgeException } from "../exceptions/bridge.exception";
import type { ITeamRunBridge } from "../interfaces/i-teamrun-bridge";
import { DesktopInfo } from "../models/desktop-info";
import { Resources } from "../resources";

export const TEAMRUN_BRIDGE = new InjectionToken<ITeamRunBridge | null>("TEAMRUN_BRIDGE");

@Injectable({ providedIn: "root" })
export class BridgeService {
  private readonly bridge: ITeamRunBridge | null = inject(TEAMRUN_BRIDGE);
  private sequence: number = 0;

  public get isAvailable(): boolean {
    return !Object.isNull(this.bridge);
  }

  public subscribeCheckpoints(listener: (value: UpdateCheckpoint) => void): () => void {
    return Object.isNull(this.bridge) ? () => undefined : this.bridge.onCheckpoint(t => listener(UpdateCheckpoint.fromJson(t)));
  }

  public checkpoint(result: UpdateCheckpointResult): Promise<boolean> {
    return Object.isNull(this.bridge) ? Promise.resolve(false) : this.bridge.checkpoint(result.toJson());
  }

  public async call(method: string, payload: JsonValue): Promise<JsonValue> {
    if (Object.isNull(this.bridge))
      throw new BridgeException(Resources.bridgeMissing, null);

    this.sequence += 1;
    const request = new Request(Resources.formatRequestId(this.sequence), method, payload);
    const response = Response.fromJson(await this.bridge.invoke(request.toJson()));
    if (!Object.isNull(response.info))
      throw new BridgeException(response.info.message, response.info);
    if (response.id !== request.id)
      throw new BridgeException(Resources.responseMismatch, null);

    return response.payload;
  }

  public subscribe(listener: (event: Event) => void): () => void {
    if (Object.isNull(this.bridge))
      return () => undefined;

    return this.bridge.onEvent(payload => listener(Event.fromJson(payload)));
  }

  public openExternal(url: string): Promise<boolean> {
    return Object.isNull(this.bridge) ? Promise.resolve(false) : this.bridge.openExternal(url);
  }

  public pickDirectory(): Promise<string | null> {
    return Object.isNull(this.bridge) ? Promise.resolve(null) : this.bridge.pickDirectory();
  }

  public async describe(): Promise<DesktopInfo | null> {
    return Object.isNull(this.bridge) ? null : DesktopInfo.fromJson(await this.bridge.describe());
  }

  public async update(command: AppUpdateCommand): Promise<AppUpdateState | null> {
    if (Object.isNull(this.bridge))
      return null;
    return AppUpdateState.fromJson(await this.bridge.update(command));
  }

  public subscribeUpdates(listener: (state: AppUpdateState) => void): () => void {
    return Object.isNull(this.bridge) ? () => undefined : this.bridge.onUpdate(t => listener(AppUpdateState.fromJson(t)));
  }

  public setTitleBar(color: string, symbolColor: string): Promise<boolean> {
    return Object.isNull(this.bridge) ? Promise.resolve(false) : this.bridge.setTitleBar(color, symbolColor);
  }

  public readImage(path: string): Promise<string | null> {
    return Object.isNull(this.bridge) ? Promise.resolve(null) : this.bridge.readImage(path);
  }
}
