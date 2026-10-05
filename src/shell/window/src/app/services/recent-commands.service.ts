/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { RecentCommands, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import type { StartupState } from "../models/startup-state";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class RecentCommandsService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly idsValue: WritableSignal<readonly string[]> = signal([]);
  private eventsSeen: number = 0;
  private isReady: boolean = false;

  public readonly ids: Signal<readonly string[]> = this.idsValue.asReadonly();

  public constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
  }

  public record(id: string): void {
    this.idsValue.update(t => [id, ...t.filter(u => u !== id)]);
    this.bridge.requestAsync(ShellMethods.recordCommand.text, { [Resources.idField]: id }).catch((error: unknown) => this.errors.handleError(error));
  }

  private follow(state: StartupState): void {
    if (state.isReady && !this.isReady)
      this.load();
    this.isReady = state.isReady;
  }

  private load(): void {
    const seen = this.eventsSeen;
    this.bridge.requestAsync(ShellMethods.recentCommands.text, null).then(t => {
      if (this.eventsSeen === seen)
        this.idsValue.set(RecentCommands.fromJson(t).ids);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private receive(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.recentCommandsChanged.text)
      return;
    this.eventsSeen++;
    try {
      this.idsValue.set(RecentCommands.fromJson(payload).ids);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }
}
