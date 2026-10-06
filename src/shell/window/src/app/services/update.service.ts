/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { UpdateAction } from "../enums/update-action";
import { UpdateState } from "../models/update-state";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { SettingsPageService } from "./settings-page.service";

@Injectable({ providedIn: "root" })
export class UpdateService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly pages: SettingsPageService = inject(SettingsPageService);
  private readonly stateValue: WritableSignal<UpdateState> = signal(UpdateState.off);
  private updatesSeen: number = 0;

  public readonly state: Signal<UpdateState> = this.stateValue.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onUpdate(t => {
      this.updatesSeen++;
      this.stateValue.set(t);
    }));
    const seen = this.updatesSeen;
    this.bridge.readUpdateAsync().then(t => {
      if (this.updatesSeen === seen)
        this.stateValue.set(t);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  public act(action: UpdateAction): void {
    this.bridge.actOnUpdateAsync(action).catch((error: unknown) => this.errors.handleError(error));
  }

  public retry(): void {
    this.act(Object.isNull(this.stateValue().version) ? UpdateAction.Check : UpdateAction.Download);
  }

  public openAbout(): void {
    this.pages.open(Resources.aboutPage);
  }
}
