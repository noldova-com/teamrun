/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type WritableSignal, effect, inject, signal } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { DockSide } from "../../enums/dock-side";
import type { GroupFrame } from "../../models/layout/group-frame";
import { LayoutService } from "../../services/layout.service";
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceComponent {
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);

  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);

  public constructor() {
    const appearance = inject(AppearanceService);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.width.set(entry.contentRect.width);
        this.height.set(entry.contentRect.height);
      }
    });
    observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    effect(() => {
      const rem = appearance.typography().rootSize;
      this.layout.setViewport(this.width() / rem, this.height() / rem);
    });
  }

  protected isEmptyDocuments(frame: GroupFrame): boolean {
    return frame.group.isDocuments && this.layout.registry().views.length === 0;
  }
}
