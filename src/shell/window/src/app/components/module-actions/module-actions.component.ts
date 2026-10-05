/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ErrorHandler,
  type InputSignal,
  type WritableSignal,
  inject,
  input,
  signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { ModuleStatus } from "@noldova/teamrun-shell-protocol";
import { ButtonComponent, ButtonVariant } from "@noldova/teamrun-shell-ui";

import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-module-actions",
  imports: [ButtonComponent],
  templateUrl: "./module-actions.component.html",
  styleUrl: "./module-actions.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-module-actions"
  }
})
export class ModuleActionsComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly isCopied: WritableSignal<boolean> = signal(false);
  protected readonly isLogFolderFailed: WritableSignal<boolean> = signal(false);

  public readonly module: InputSignal<ModuleStatus> = input.required<ModuleStatus>();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearCopiedTimer());
  }

  protected copy(): void {
    this.copyAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  protected openLogFolder(): void {
    this.bridge.openLogFolderAsync().then(
      t => this.isLogFolderFailed.set(!t),
      (error: unknown) => {
        this.isLogFolderFailed.set(true);
        this.errors.handleError(error);
      });
  }

  private async copyAsync(): Promise<void> {
    const build = await this.bridge.readBuildAsync();
    const module = this.module();
    const lines = [
      Resources.formatBuildDetails(build.productVersion, build.fingerprint),
      Resources.formatModuleDetails(module.id, module.version, module.state, module.cause)
    ];
    if (!await this.bridge.copyTextAsync(lines.join(Resources.detailsSeparator)))
      return;
    this.clearCopiedTimer();
    this.isCopied.set(true);
    this.copiedTimer = setTimeout(() => {
      this.copiedTimer = null;
      this.isCopied.set(false);
    }, Resources.copiedDuration);
  }

  private clearCopiedTimer(): void {
    if (!Object.isNull(this.copiedTimer))
      clearTimeout(this.copiedTimer);
    this.copiedTimer = null;
  }
}
