/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, DestroyRef, ErrorHandler, type Signal, ViewEncapsulation, type WritableSignal, computed, inject, input, model, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { CopyState } from "../../enums/copy-state";
import { ClipboardWriter } from "../../services/clipboard-writer";
import { Resources } from "../../../resources";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { ToolbarItemDirective } from "../toolbar/toolbar-item.directive";
import { ToolbarDirective } from "../toolbar/toolbar.directive";
import { TooltipDirective } from "../tooltip/tooltip.directive";

@Component({
  selector: "tr-code-block",
  imports: [IconButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective],
  templateUrl: "./code-block.component.html",
  styleUrl: "./code-block.component.scss",
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-code-block",
    "[class.tr-code-block-wrapped]": "wrapped()"
  }
})
export class CodeBlockComponent {
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly copyState: WritableSignal<CopyState> = signal(CopyState.Ready);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly isCopied: Signal<boolean> = computed(() => this.copyState() === CopyState.Copied);
  protected readonly copyGlyph: Signal<string> = computed(() => Resources.copyGlyphs[this.copyState()]);
  protected readonly copyLabel: Signal<string> = computed(() => Resources.copyLabels[this.copyState()]);

  public readonly code = input.required<string>();
  public readonly language = input<string | null>(null);
  public readonly wrapped = model<boolean>(false);

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearCopyTimer());
  }

  protected toggleWrap(): void {
    this.wrapped.update(t => !t);
  }

  protected copy(): void {
    this.clipboard.writeTextAsync(this.code()).then(
      t => this.showCopy(t ? CopyState.Copied : CopyState.Failed),
      (error: unknown) => {
        this.showCopy(CopyState.Failed);
        this.errors.handleError(error);
      });
  }

  private showCopy(state: CopyState): void {
    this.clearCopyTimer();
    this.copyState.set(state);
    void this.announcer.announce(Resources.copyLabels[state], Resources.politeAnnouncement);
    this.copyTimer = setTimeout(() => {
      this.copyTimer = null;
      this.copyState.set(CopyState.Ready);
    }, Resources.copyFeedbackDuration);
  }

  private clearCopyTimer(): void {
    if (!Object.isNull(this.copyTimer))
      clearTimeout(this.copyTimer);
    this.copyTimer = null;
  }
}
