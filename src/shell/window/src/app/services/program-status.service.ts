/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type ProgramStatus, ProgramStatusList, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import type { StartupState } from "../models/startup-state";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { WindowPartHostService } from "./window-part-host.service";

@Injectable({ providedIn: "root" })
export class ProgramStatusService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly listValue: WritableSignal<ProgramStatusList | null> = signal(null);
  private connection: number = 0;
  private generationRead: number = 0;

  public readonly programs: Signal<readonly ProgramStatus[]> = computed(() => this.listValue()?.programs ?? []);

  public constructor() {
    const host = inject(WindowPartHostService);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    effect(() => {
      const generation = host.generation();
      if (generation > this.generationRead) {
        this.generationRead = generation;
        untracked(() => this.load());
      }
    });
  }

  public ofModule(moduleId: string): readonly ProgramStatus[] {
    return this.programs().filter(t => t.moduleId === moduleId);
  }

  private follow(state: StartupState): void {
    if (state.isReady)
      return;
    this.connection++;
    this.listValue.set(null);
  }

  private load(): void {
    const connection = this.connection;
    this.bridge.requestAsync(ShellMethods.programs.text, null).then(t => {
      const list = ProgramStatusList.fromJson(t);
      if (this.connection === connection)
        this.apply(list);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private receive(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.programsChanged.text)
      return;
    try {
      this.apply(ProgramStatusList.fromJson(payload));
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private apply(list: ProgramStatusList): void {
    const current = this.listValue();
    if (Object.isNull(current) || list.sequence > current.sequence)
      this.listValue.set(list);
  }
}
