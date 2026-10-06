/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { AppearanceSettingsService } from "../../services/appearance-settings.service";
import { SpellingService } from "../../services/spelling.service";
import { ClosingService } from "../../services/closing.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { LinkService } from "../../services/link.service";
import { QuitService } from "../../services/quit.service";
import { RecentCommandsService } from "../../services/recent-commands.service";
import { StartupService } from "../../services/startup.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { FieldMenuComponent } from "../field-menu/field-menu.component";
import { StartupComponent } from "../startup/startup.component";
import { StatusBarComponent } from "../status-bar/status-bar.component";
import { ToolbarBandComponent } from "../toolbar-band/toolbar-band.component";
import { ToastsComponent } from "../toasts/toasts.component";
import { WindowRowComponent } from "../window-row/window-row.component";
import { WorkspaceComponent } from "../workspace/workspace.component";

@Component({
  selector: "tr-window",
  imports: [FieldMenuComponent, StartupComponent, StatusBarComponent, ToastsComponent, ToolbarBandComponent, WindowRowComponent, WorkspaceComponent],
  templateUrl: "./window.component.html",
  styleUrl: "./window.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WindowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly closing: ClosingService = inject(ClosingService);

  protected readonly startup: StartupService = inject(StartupService);

  public constructor() {
    inject(AppearanceService);
    inject(AppearanceSettingsService);
    inject(SpellingService);
    inject(WindowPartHostService);
    inject(RecentCommandsService);
    const destroyed = inject(DestroyRef);
    destroyed.onDestroy(this.bridge.onCloseRequest(t => void this.closeAsync(t)));
    destroyed.onDestroy(this.bridge.onUpdateSaveRequest(t => void this.saveForUpdateAsync(t)));
    destroyed.onDestroy(inject(QuitService).listen());
    destroyed.onDestroy(inject(LinkService).listen());
  }

  private async closeAsync(requestId: string): Promise<void> {
    await this.bridge.answerCloseAsync(requestId, await this.closing.saveAsync());
  }

  private async saveForUpdateAsync(requestId: string): Promise<void> {
    await this.bridge.answerUpdateSaveAsync(requestId, await this.closing.saveForUpdateAsync());
  }
}
