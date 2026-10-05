/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { RecentCommands, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { WindowPartHostService } from "./window-part-host.service";

@Injectable({ providedIn: "root" })
export class RecentCommandsService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly idsValue: WritableSignal<readonly string[]> = signal([]);
  private eventsSeen: number = 0;
  private generationRead: number = 0;

  public readonly ids: Signal<readonly string[]> = this.idsValue.asReadonly();

  public constructor() {
    const host = inject(WindowPartHostService);
    inject(DestroyRef).onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    effect(() => {
      const generation = host.generation();
      if (generation > this.generationRead) {
        this.generationRead = generation;
        untracked(() => this.load());
      }
    });
  }

  public record(id: string): void {
    this.idsValue.update(t => [id, ...t.filter(u => u !== id)]);
    this.bridge.requestAsync(ShellMethods.recordCommand.text, { [Resources.idField]: id }).catch((error: unknown) => this.errors.handleError(error));
  }

  private load(): void {
    const seen = this.eventsSeen;
    this.bridge.requestAsync(ShellMethods.recentCommands.text, {}).then(t => {
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
