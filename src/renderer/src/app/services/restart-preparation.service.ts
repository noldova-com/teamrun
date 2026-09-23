/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, DestroyRef, Injectable, inject, signal } from "@angular/core";
import { OverlayContainer } from "@angular/cdk/overlay";

import "@noldova/teamrun-foundation-core";
import { UpdateCheckpoint, UpdateCheckpointPhase, UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";
import { ComposerDraftsService } from "./composer-drafts.service";
import { PreferencesService } from "./preferences.service";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class RestartPreparationService {
  private readonly bridge = inject(BridgeService);
  private readonly drafts = inject(ComposerDraftsService);
  private readonly preferences = inject(PreferencesService);
  private readonly layout = inject(LayoutService);
  private readonly overlays = inject(OverlayContainer);
  private readonly application = inject(ApplicationRef);
  private captureComposer: (() => Promise<boolean>) | null = null;
  private operation: string | null = null;
  private previousOverlayInert: boolean = false;

  public readonly frozen = this.drafts.frozen.asReadonly();
  public readonly error = signal<string | null>(null);

  public constructor() {
    const unsubscribe = this.bridge.subscribeCheckpoints(t => void this.handle(t));
    inject(DestroyRef).onDestroy(() => { unsubscribe(); this.resume(); });
  }

  public attachComposer(capture: (() => Promise<boolean>) | null): void {
    this.captureComposer = capture;
  }

  private async handle(checkpoint: UpdateCheckpoint): Promise<void> {
    if (checkpoint.phase === UpdateCheckpointPhase.Resume) {
      if (this.operation === checkpoint.id)
        this.resume();
      return;
    }
    if (!Object.isNull(this.operation))
      return;
    this.operation = checkpoint.id;
    this.error.set(null);
    const overlay = this.overlays.getContainerElement();
    this.previousOverlayInert = overlay.inert;
    overlay.inert = true;
    this.drafts.frozen.set(true);
    let ready = false;
    try {
      await this.application.whenStable();
      if (this.operation !== checkpoint.id)
        return;
      ready = !this.drafts.preparing()
        && !Object.isNull(this.captureComposer) && await this.captureComposer()
        && this.preferences.flush() && this.layout.flush();
    }
    catch {
      ready = false;
    }
    if (this.operation !== checkpoint.id)
      return;
    if (!ready) {
      this.error.set(Resources.restartPreparationFailed);
      this.resume();
    }
    try {
      await this.bridge.checkpoint(new UpdateCheckpointResult(checkpoint.id, ready));
    }
    catch {
      if (this.operation === checkpoint.id) {
        this.error.set(Resources.restartPreparationFailed);
        this.resume();
      }
    }
  }

  private resume(): void {
    if (!Object.isNull(this.operation))
      this.overlays.getContainerElement().inert = this.previousOverlayInert;
    this.operation = null;
    this.drafts.frozen.set(false);
  }
}
