/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ErrorHandler, PendingTasks, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

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

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof UpdateStateKind = UpdateStateKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly version: WritableSignal<string> = signal(Resources.productName);
  protected readonly platform: string;
  protected readonly state: Signal<UpdateState> = this.updates.state;
  protected readonly canUpdate: Signal<boolean> = computed(() => this.state().kind !== UpdateStateKind.Off && !this.state().mustMove);
  protected readonly status: Signal<string> = computed(() => this.statusOf(this.state()));
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
  }

  private statusOf(state: UpdateState): string {
    if (state.kind === UpdateStateKind.Off)
      return Resources.updatesOff;
    if (state.mustMove)
      return Resources.moveToApplications;
    const version = state.version ?? String.empty;
    switch (state.kind) {
      case UpdateStateKind.UpToDate:
        return Resources.formatUpToDate(Object.isNull(state.checkedAt) ? null : this.time.format(state.checkedAt));
      case UpdateStateKind.Checking:
        return Resources.checkingForUpdates;
      case UpdateStateKind.Available:
        return Resources.moveToApplications;
      case UpdateStateKind.Downloading:
        return Resources.formatDownloadingVersion(state.version, state.progress);
      case UpdateStateKind.Ready:
        return Resources.formatUpdateReady(version);
      case UpdateStateKind.Failed:
        return Resources.updateFailed;
    }
  }

  protected check(): void {
    this.updates.act(UpdateAction.Check);
  }

  protected restart(): void {
    this.updates.act(UpdateAction.Restart);
  }
}
