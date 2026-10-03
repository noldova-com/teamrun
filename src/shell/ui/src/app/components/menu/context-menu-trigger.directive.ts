/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FocusOrigin } from "@angular/cdk/a11y";
import { CdkMenuTriggerBase, MENU_STACK, MenuStack, MenuTracker } from "@angular/cdk/menu";
import { Directive, ElementRef, Injector, inject } from "@angular/core";
import { takeUntil } from "rxjs";

import "@noldova/teamrun-foundation-core";

import { OverlayAlignment } from "../../enums/overlay-alignment";
import { OverlayAnchoring } from "../../models/overlay-anchoring";
import { OverlaySide } from "../../models/overlay-side";
import { AnchoredOverlay } from "../../services/anchored-overlay";
import { Resources } from "../../../resources";

@Directive({
  selector: "[trContextMenuTriggerFor]",
  exportAs: "trContextMenuTriggerFor",
  inputs: [{ name: "menuTemplateRef", alias: "trContextMenuTriggerFor" }],
  host: {
    "[attr.data-cdk-menu-stack-id]": "null",
    "(contextmenu)": "openAtPointer($event)",
    "(keydown)": "openFromKeyboard($event)"
  },
  providers: [{ provide: MENU_STACK, useClass: MenuStack }]
})
export class ContextMenuTriggerDirective extends CdkMenuTriggerBase {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly tracker: MenuTracker = inject(MenuTracker);
  private readonly anchored: AnchoredOverlay = new AnchoredOverlay(inject(Injector), Resources.menuPaneClass);
  private echoes: readonly string[] = [];

  public constructor() {
    super();
    this.overlayRef = this.anchored.overlayRef;
    this.menuStack.closed.pipe(takeUntil(this.destroyed)).subscribe(({ item, focusParentTrigger }) => {
      if (item === this.childMenu && this.isOpen()) {
        this.closed.next();
        this.anchored.close();
      }
      if (focusParentTrigger === true && this.menuStack.isEmpty())
        this.host.focus();
    });
    this.menuStack.hasFocus.pipe(takeUntil(this.destroyed)).subscribe(hasFocus => {
      if (!hasFocus)
        this.menuStack.closeAll();
    });
    this.anchored.outsidePointerEvents.pipe(takeUntil(this.destroyed)).subscribe(event => this.closeFromOutside(event));
    this.anchored.originScrolls.pipe(takeUntil(this.destroyed)).subscribe(() => this.menuStack.closeAll());
  }

  public open(point: DOMRect, origin: FocusOrigin): void {
    this.tracker.update(this);
    this.menuStack.closeAll();
    const portal = this.getMenuContentPortal();
    if (Object.isUndefined(portal))
      return;
    this.opened.next();
    this.anchored.overlayRef.attach(portal);
    this.anchored.follow(this.host, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 0), () => point);
    this.childMenu?.focusFirstItem(origin);
  }

  public close(): void {
    this.menuStack.closeAll();
  }

  protected openAtPointer(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.echoes = event.ctrlKey ? [Resources.auxclickEvent, Resources.clickEvent] : [Resources.auxclickEvent];
    this.open(new DOMRect(event.clientX, event.clientY, 0, 0), event.button === Resources.secondaryButton ? Resources.mouseFocusOrigin : Resources.keyboardFocusOrigin);
  }

  protected openFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== Resources.contextMenuKey && !(event.key === Resources.menuKey && event.shiftKey))
      return;
    event.preventDefault();
    this.echoes = [];
    const bounds = this.host.getBoundingClientRect();
    this.open(new DOMRect(bounds.left, bounds.bottom, 0, 0), Resources.keyboardFocusOrigin);
  }

  private closeFromOutside(event: MouseEvent): void {
    if (this.echoes.includes(event.type)) {
      this.echoes = this.echoes.filter(t => t !== event.type);
      return;
    }
    this.menuStack.closeAll();
  }
}
