/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type WritableSignal, afterRenderEffect, effect, inject, signal } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { DockSide } from "../../enums/dock-side";
import type { GroupFrame } from "../../models/layout/group-frame";
import { LayoutService } from "../../services/layout.service";
import { StartupService } from "../../services/startup.service";
import { ViewDialogService } from "../../services/view-dialog.service";
import { DockComponent } from "../dock/dock.component";
import { DockingGuidesComponent } from "../docking-guides/docking-guides.component";
import { EmptyWindowComponent } from "../empty-window/empty-window.component";
import { SplitSashComponent } from "../split-sash/split-sash.component";
import { TabContentComponent } from "../tab-content/tab-content.component";
import { TabGroupComponent } from "../tab-group/tab-group.component";

@Component({
  selector: "tr-workspace",
  imports: [DockComponent, DockingGuidesComponent, EmptyWindowComponent, SplitSashComponent, TabContentComponent, TabGroupComponent],
  templateUrl: "./workspace.component.html",
  styleUrl: "./workspace.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[attr.inert]": "startup.isReconnecting() ? '' : null",
    "(focusin)": "remember($event)"
  }
})
export class WorkspaceComponent {
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);
  private focused: HTMLElement | null = null;

  protected readonly startup: StartupService = inject(StartupService);
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly dialogs: ViewDialogService = inject(ViewDialogService);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);

  public constructor() {
    const appearance = inject(AppearanceService);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.width.set(entry.contentRect.width);
        this.height.set(entry.contentRect.height);
      }
    });
    observer.observe(this.element);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    effect(() => {
      const rem = appearance.typography().rootSize;
      this.layout.setViewport(this.width() / rem, this.height() / rem);
    });
    afterRenderEffect(() => {
      if (!this.startup.isReconnecting())
        this.restoreFocus();
    });
  }

  protected remember(event: FocusEvent): void {
    this.focused = event.target as HTMLElement;
  }

  protected isEmptyDocuments(frame: GroupFrame): boolean {
    return frame.group.isDocuments && this.layout.registry().views.length === 0;
  }

  private restoreFocus(): void {
    const document = this.element.ownerDocument;
    if (!Object.isNull(this.focused) && this.element.contains(this.focused) && document.activeElement === document.body)
      this.focused.focus({ preventScroll: true });
  }
}
