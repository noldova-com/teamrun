/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, afterRenderEffect, effect, inject, signal, untracked } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { DockSide } from "../../enums/dock-side";
import type { GroupFrame } from "../../models/layout/group-frame";
import { LayoutService } from "../../services/layout.service";
import { StartupService } from "../../services/startup.service";
import { TabFocusService } from "../../services/tab-focus.service";
import { ViewDialogService } from "../../services/view-dialog.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { DockComponent } from "../dock/dock.component";
import { DockingGuidesComponent } from "../docking-guides/docking-guides.component";
import { EmptyWindowComponent } from "../empty-window/empty-window.component";
import { SplitSashComponent } from "../split-sash/split-sash.component";
import { TabContentComponent } from "../tab-content/tab-content.component";
import { TabGroupComponent } from "../tab-group/tab-group.component";
import { Resources } from "../../../resources";

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
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly generation: Signal<number> = inject(WindowPartHostService).generation;
  private focused: HTMLElement | null = null;
  private focusedGroup: number | null = null;

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
      this.generation();
      if (!this.startup.isReconnecting())
        untracked(() => this.restoreFocus());
    });
  }

  protected remember(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const group = target.closest<HTMLElement>(Resources.tabGroupSelector)?.dataset[Resources.tabGroupData];
    this.focused = target;
    this.focusedGroup = Object.isUndefined(group) ? null : Number(group);
  }

  protected isEmptyDocuments(frame: GroupFrame): boolean {
    return frame.group.isDocuments && this.layout.registry().views.length === 0;
  }

  private restoreFocus(): void {
    const document = this.element.ownerDocument;
    if (document.activeElement !== document.body)
      return;
    if (!Object.isNull(this.focused) && this.element.contains(this.focused)) {
      this.focused.focus({ preventScroll: true });
      return;
    }
    const tab = this.layout.layout().groups.find(t => t.id === this.focusedGroup)?.active;
    if (!Object.isNullOrUndefined(tab))
      this.tabFocus.focus(tab);
  }
}
