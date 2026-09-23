/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";

import { DockSide } from "../../enums/dock-side";
import { PanelId } from "../../enums/panel-id";
import { ShortcutAction } from "../../enums/shortcut-action";
import { Resources } from "../../resources";
import { HistoryService } from "../../services/history.service";
import { LayoutService } from "../../services/layout.service";
import { NavigationService } from "../../services/navigation.service";
import { SearchLauncher } from "../../services/search-launcher.service";
import { ShortcutsService } from "../../services/shortcuts.service";

@Component({
  selector: "tr-window-controls",
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./window-controls.component.html"
})
export class WindowControlsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly leftSide: DockSide = DockSide.Left;
  protected readonly isLeftCollapsed: Signal<boolean> = computed(() => this.layout.layout().dock(DockSide.Left).collapsed);
  protected readonly history: HistoryService = inject(HistoryService);
  protected readonly search: SearchLauncher = inject(SearchLauncher);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly shortcuts: ShortcutsService = inject(ShortcutsService);
  protected readonly panels: readonly PanelId[] = Object.values(PanelId);
  protected readonly hideSidebarTooltip: string = Resources.formatWithKeys(Resources.hideSidebarLabel, this.shortcuts.keysOf(ShortcutAction.ToggleSidebar));
  protected readonly showSidebarTooltip: string = Resources.formatWithKeys(Resources.showSidebarLabel, this.shortcuts.keysOf(ShortcutAction.ToggleSidebar));
  protected readonly backTooltip: string = Resources.formatWithKeys(Resources.historyBackLabel, this.shortcuts.keysOf(ShortcutAction.Back));
  protected readonly forwardTooltip: string = Resources.formatWithKeys(Resources.historyForwardLabel, this.shortcuts.keysOf(ShortcutAction.Forward));
  protected readonly searchTooltip: string = Resources.formatWithKeys(Resources.searchLabel, this.shortcuts.keysOf(ShortcutAction.Search));
  protected readonly settingsTooltip: string = Resources.formatWithKeys(Resources.settingsTitle, this.shortcuts.keysOf(ShortcutAction.OpenSettings));
}
