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

import { Resources } from "../../../resources";

@Component({
  selector: "tr-menu",
  templateUrl: "./menu.component.html",
  styleUrl: "./menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkMenu, CdkTargetMenuAim],
  host: {
    "[class.tr-menu-pointer-still]": "isPointerStill()"
  }
})
export class MenuComponent {
  protected readonly isPointerStill: WritableSignal<boolean> = signal(true);

  public constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const document = inject(DOCUMENT);
    const held: Element[] = [];
    const holdEnter = (event: MouseEvent): void => {
      event.stopPropagation();
      held.push(event.target as Element);
    };
    const stop = (): void => {
      host.removeEventListener(Resources.mouseenterEvent, holdEnter, true);
      document.removeEventListener(Resources.pointermoveEvent, release, true);
    };
    const release = (): void => {
      stop();
      this.isPointerStill.set(false);
      for (const element of held.splice(0))
        if (element.matches(Resources.hoverSelector))
          element.dispatchEvent(new MouseEvent(Resources.mouseenterEvent));
    };
    host.addEventListener(Resources.mouseenterEvent, holdEnter, true);
    document.addEventListener(Resources.pointermoveEvent, release, true);
    inject(DestroyRef).onDestroy(stop);
  }
}
