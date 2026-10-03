/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ErrorHandler, inject } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { LayoutService } from "../../services/layout.service";
import { StartupService } from "../../services/startup.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { StartupComponent } from "../startup/startup.component";
import { StatusBarComponent } from "../status-bar/status-bar.component";
import { ToastsComponent } from "../toasts/toasts.component";
import { WindowRowComponent } from "../window-row/window-row.component";
import { WorkspaceComponent } from "../workspace/workspace.component";

@Component({
  selector: "tr-window",
  imports: [StartupComponent, StatusBarComponent, ToastsComponent, WindowRowComponent, WorkspaceComponent],
  templateUrl: "./window.component.html",
  styleUrl: "./window.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WindowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly startup: StartupService = inject(StartupService);

  public constructor() {
    inject(AppearanceService);
    inject(WindowPartHostService);
    inject(DestroyRef).onDestroy(this.bridge.onCloseRequest(t => void this.closeAsync(t)));
  }

  private async closeAsync(requestId: string): Promise<void> {
    try {
      await this.layout.saveAsync();
    }
    catch (error) {
      this.errors.handleError(error);
    }
    await this.bridge.answerCloseAsync(requestId, true);
  }
}
