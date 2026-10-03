/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, afterRenderEffect, inject } from "@angular/core";

import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { WindowAppearance } from "../../models/window-appearance";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";

@Component({
  selector: "tr-window-row",
  templateUrl: "./window-row.component.html",
  styleUrl: "./window-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-tr-chrome": "top",
    "[class.tr-window-row-mac]": "isMac"
  }
})
export class WindowRowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);

  protected readonly isMac: boolean = this.bridge.isMac;

  public constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const appearance = inject(AppearanceService);
    let isReported = false;
    afterNextRender(() => this.bridge.notifyReady(WindowAppearance.read(host)));
    afterRenderEffect(() => {
      appearance.theme();
      appearance.mode();
      if (isReported)
        this.bridge.notifyAppearance(WindowAppearance.read(host));
      isReported = true;
    });
  }
}
