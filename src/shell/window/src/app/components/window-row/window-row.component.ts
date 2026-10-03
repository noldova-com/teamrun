/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, ElementRef, ErrorHandler, afterNextRender, afterRenderEffect, inject } from "@angular/core";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, IconButtonComponent, OverlaySide, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { WindowAppearance } from "../../models/window-appearance";
import { BarItemsService } from "../../services/bar-items.service";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";

@Component({
  selector: "tr-window-row",
  imports: [IconButtonComponent, TooltipDirective],
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
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly isMac: boolean = this.bridge.isMac;
  protected readonly bars: BarItemsService = inject(BarItemsService);
  protected readonly below: OverlaySide = OverlaySide.below;

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

  protected isAvailable(command: string): boolean {
    return this.commands.commands().some(t => t.name === command);
  }

  protected run(command: string, commandArguments: JsonValue): void {
    this.commands.runAsync(command, commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }
}
