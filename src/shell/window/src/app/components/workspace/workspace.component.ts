/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, computed, inject, input, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AppearanceService, PanelCardComponent, PanelSurface } from "@noldova/teamrun-shell-ui";

import { EmptyWindowComponent } from "../empty-window/empty-window.component";
import type { GroupFrame } from "../../models/layout/group-frame";
import type { Layout } from "../../models/layout/layout";
import { LayoutGeometry } from "../../models/layout/layout-geometry";
import type { ViewRegistry } from "../../models/layout/view-registry";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-workspace",
  imports: [EmptyWindowComponent, PanelCardComponent],
  templateUrl: "./workspace.component.html",
  styleUrl: "./workspace.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceComponent {
  private readonly appearance: AppearanceService = inject(AppearanceService);
  private readonly width: WritableSignal<number> = signal(0);
  private readonly height: WritableSignal<number> = signal(0);

  public readonly layout = input.required<Layout>();
  public readonly registry = input.required<ViewRegistry>();

  protected readonly geometry: Signal<LayoutGeometry> = computed(() => {
    const rem = this.appearance.typography().rootSize;
    return new LayoutGeometry(this.width() / rem, this.height() / rem, this.layout(), this.registry());
  });

  public constructor() {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.width.set(entry.contentRect.width);
        this.height.set(entry.contentRect.height);
      }
    });
    observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected surfaceOf(frame: GroupFrame): PanelSurface {
    return Object.isNull(frame.side) ? PanelSurface.Panel : PanelSurface.Shell;
  }

  protected isEmptyDocuments(frame: GroupFrame): boolean {
    return frame.group.id === Resources.documentsGroupId && this.registry().views.length === 0;
  }
}
