/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject } from "@angular/core";

import { WindowAppearance } from "../../models/window-appearance";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";

@Component({
  selector: "tr-window-row",
  templateUrl: "./window-row.component.html",
  styleUrl: "./window-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.tr-window-row-mac]": "isMac"
  }
})
export class WindowRowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);

  protected readonly isMac: boolean = this.bridge.isMac;

  public constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => this.bridge.notifyReady(WindowAppearance.read(host)));
  }
}
