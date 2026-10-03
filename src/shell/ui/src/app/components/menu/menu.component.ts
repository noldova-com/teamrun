/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { CdkMenu, CdkTargetMenuAim } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, type WritableSignal, inject, signal } from "@angular/core";

import { ScreenPoint } from "../../models/screen-point";
import { PointerPositionService } from "../../services/pointer-position.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-menu",
  templateUrl: "./menu.component.html",
  styleUrl: "./menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkMenu, CdkTargetMenuAim],
  host: {
    "class": "tr-scroll-reveal",
    "[class.tr-menu-pointer-still]": "isPointerStill()"
  }
})
export class MenuComponent {
  protected readonly isPointerStill: WritableSignal<boolean> = signal(true);
  private origin: ScreenPoint | null = inject(PointerPositionService).position;

  public constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const document = inject(DOCUMENT);
    const blocked: Element[] = [];
    const isStill = (event: MouseEvent): boolean => {
      const point = ScreenPoint.of(event);
      this.origin ??= point;
      return point.equals(this.origin);
    };
    const release = (): void => {
      this.isPointerStill.set(false);
      host.removeEventListener(Resources.mouseenterEvent, holdEnter, true);
      document.removeEventListener(Resources.pointermoveEvent, watchMove, true);
      for (const element of blocked.splice(0))
        if (element.matches(Resources.hoverSelector))
          element.dispatchEvent(new MouseEvent(Resources.mouseenterEvent));
    };
    const holdEnter = (event: MouseEvent): void => {
      if (!isStill(event)) {
        release();
        return;
      }
      event.stopPropagation();
      blocked.push(event.target as Element);
    };
    const watchMove = (event: PointerEvent): void => {
      if (!isStill(event))
        release();
    };
    host.addEventListener(Resources.mouseenterEvent, holdEnter, true);
    document.addEventListener(Resources.pointermoveEvent, watchMove, true);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener(Resources.mouseenterEvent, holdEnter, true);
      document.removeEventListener(Resources.pointermoveEvent, watchMove, true);
    });
  }
}
