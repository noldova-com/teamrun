/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, ErrorHandler, PendingTasks, type Signal, type WritableSignal, computed, effect, inject, signal, untracked,
  viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ButtonComponent, ButtonVariant, ProgressComponent } from "@noldova/teamrun-shell-ui";

import { UpdateAction } from "../../enums/update-action";
import { UpdateStateKind } from "../../enums/update-state-kind";
import type { UpdateState } from "../../models/update-state";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { UpdateService } from "../../services/update.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-about",
  imports: [ButtonComponent, ProgressComponent],
  templateUrl: "./about.component.html",
  styleUrl: "./about.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-settings-group",
    "role": "region",
    "[attr.aria-label]": "resources.aboutLabel"
  }
})
export class AboutComponent {
  private readonly updates: UpdateService = inject(UpdateService);
  private readonly time: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  private readonly dayAndTime: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  private readonly statusElement: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("statusLine");
  private readonly document: Document = inject(DOCUMENT);
  private shownKind: UpdateStateKind | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof UpdateStateKind = UpdateStateKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly version: WritableSignal<string> = signal(Resources.productName);
  protected readonly platform: string;
  protected readonly state: Signal<UpdateState> = this.updates.state;
  protected readonly status: Signal<string> = computed(() => this.statusOf(this.state()));
  protected readonly percent: Signal<string | null> = computed(() => {
    const state = this.state();
    return state.kind !== UpdateStateKind.Downloading || Object.isNull(state.progress) ? null : Resources.formatDownloadPercent(state.progress);
  });
  protected readonly details: Signal<readonly string[]> = computed(() => this.detailsOf(this.state()));
  protected readonly showsMoveHint: Signal<boolean> = computed(() => this.state().kind === UpdateStateKind.Failed && this.state().mustMove);
  protected readonly progressLabel: Signal<string> = computed(() => Resources.formatDownloadingVersion(this.state().version));
  protected readonly share: Signal<number | null> = computed(() => {
    const progress = this.state().progress;
    return Object.isNull(progress) ? null : progress / 100;
  });

  public constructor() {
    const bridge = inject(DesktopBridgeService);
    const errors = inject(ErrorHandler);
    this.platform = Resources.formatPlatform(bridge.platform, bridge.processor);
    void inject(PendingTasks).run(() =>
      bridge.readBuildAsync().then(t => this.version.set(Resources.formatProductVersion(t.productVersion)), (error: unknown) => errors.handleError(error)));
    effect(() => {
      const kind = this.state().kind;
      if (kind !== this.shownKind)
        untracked(() => this.keepFocus());
      this.shownKind = kind;
    });
  }

  private statusOf(state: UpdateState): string {
    switch (state.kind) {
      case UpdateStateKind.Off:
        return Resources.updatesOff;
      case UpdateStateKind.UpToDate:
        return Resources.upToDate;
      case UpdateStateKind.Checking:
        return Resources.checkingForUpdates;
      case UpdateStateKind.Available:
        return Resources.moveToApplications;
      case UpdateStateKind.Downloading:
        return Resources.formatDownloadingLine(state.version);
      case UpdateStateKind.Ready:
        return Resources.formatUpdateReady(state.version);
      case UpdateStateKind.Failed:
        return Resources.updateFailed;
    }
  }

  private detailsOf(state: UpdateState): readonly string[] {
    if (state.kind === UpdateStateKind.UpToDate && !Object.isNull(state.checkedAt))
      return [Resources.formatLastChecked(this.formatChecked(state.checkedAt))];
    return [UpdateStateKind.Ready, UpdateStateKind.Failed].includes(state.kind) && !Object.isNull(state.reason) ? [state.reason] : [];
  }

  private formatChecked(checkedAt: number): string {
    return new Date(checkedAt).toDateString() === new Date().toDateString() ? this.time.format(checkedAt) : this.dayAndTime.format(checkedAt);
  }

  private keepFocus(): void {
    const status = this.statusElement().nativeElement;
    const focused = this.document.activeElement;
    if (focused instanceof HTMLButtonElement && focused.parentElement === status.parentElement)
      status.focus();
  }

  protected check(): void {
    this.updates.act(UpdateAction.Check);
  }

  protected restart(): void {
    this.updates.act(UpdateAction.Restart);
  }
}
