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
  ElementRef,
  ErrorHandler,
  type InputSignal,
  type WritableSignal,
  afterNextRender,
  inject,
  input,
  signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ButtonComponent, ButtonVariant } from "@noldova/teamrun-shell-ui";

import type { ModuleFailure } from "../../models/module-failure";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-module-failures-popover",
  imports: [ButtonComponent],
  templateUrl: "./module-failures-popover.component.html",
  styleUrl: "./module-failures-popover.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-module-failures-popover",
    "role": "dialog",
    "tabindex": "-1",
    "[attr.aria-label]": "resources.moduleFailuresTitle"
  }
})
export class ModuleFailuresPopoverComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly isCopied: WritableSignal<boolean> = signal(false);
  protected readonly isLogFolderFailed: WritableSignal<boolean> = signal(false);

  public readonly failures: InputSignal<readonly ModuleFailure[]> = input.required<readonly ModuleFailure[]>();

  public constructor() {
    const host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.focus());
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
    const lines = [
      Resources.formatBuildDetails(build.productVersion, build.fingerprint),
      ...this.failures().map(t => Resources.formatModuleDetails(t.moduleId, t.state, t.cause))
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
