/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, inject } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { Layout } from "../../models/layout/layout";
import { ViewRegistry } from "../../models/layout/view-registry";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { StatusBarComponent } from "../status-bar/status-bar.component";
import { WindowRowComponent } from "../window-row/window-row.component";
import { WorkspaceComponent } from "../workspace/workspace.component";

@Component({
  selector: "tr-window",
  imports: [StatusBarComponent, WindowRowComponent, WorkspaceComponent],
  templateUrl: "./window.component.html",
  styleUrl: "./window.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WindowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);

  protected readonly registry: ViewRegistry = ViewRegistry.createEmpty();
  protected readonly layout: Layout = Layout.createDefault(this.registry);

  public constructor() {
    inject(AppearanceService);
    inject(DestroyRef).onDestroy(this.bridge.onCloseRequest(t => void this.bridge.answerCloseAsync(t, true)));
  }
}
