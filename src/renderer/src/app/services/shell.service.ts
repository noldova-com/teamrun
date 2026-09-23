/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import { DockSide } from "../enums/dock-side";
import { ShellFit } from "../models/shell-fit";
import { Resources } from "../resources";
import { LayoutService } from "./layout.service";
import { ViewportService } from "./viewport.service";

@Injectable({ providedIn: "root" })
export class ShellService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly viewport: ViewportService = inject(ViewportService);

  public readonly across: Signal<ShellFit> = computed(() =>
    ShellFit.of(this.viewport.width(), [this.layout.layout().dock(DockSide.Left), this.layout.layout().dock(DockSide.Right)]));
  public readonly down: Signal<ShellFit> = computed(() =>
    ShellFit.of(this.viewport.height() - Resources.windowRowHeight, [this.layout.layout().dock(DockSide.Bottom)]));
  public readonly columns: Signal<string> = computed(() => Resources.formatDockColumns(this.track(DockSide.Left), this.track(DockSide.Right)));
  public readonly rows: Signal<string> = computed(() => Resources.formatDockRows(this.track(DockSide.Bottom)));

  public maximumSize(side: DockSide): number {
    return (side === DockSide.Bottom ? this.down() : this.across()).maximum(side) - Resources.shellGap;
  }

  public track(side: DockSide): string {
    const track = (side === DockSide.Bottom ? this.down() : this.across()).track(side);

    return track === 0 ? Resources.hiddenTrack : Resources.formatPixels(track);
  }
}
