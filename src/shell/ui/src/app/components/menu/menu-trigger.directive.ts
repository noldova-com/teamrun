/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CDK_MENU, CdkMenuTrigger, type Menu, PARENT_OR_NEW_MENU_STACK_PROVIDER } from "@angular/cdk/menu";
import { Directive, ElementRef, Injector, forwardRef, inject, input } from "@angular/core";
import { takeUntil } from "rxjs";

import "@noldova/teamrun-foundation-core";

import { OverlayAlignment } from "../../enums/overlay-alignment";
import { OverlayAnchoring } from "../../models/overlay-anchoring";
import { OverlaySide } from "../../models/overlay-side";
import { AnchoredOverlay } from "../../services/anchored-overlay";
import { PointerPositionService } from "../../services/pointer-position.service";
import { Resources } from "../../../resources";

@Directive({
  selector: "[trMenuTriggerFor]",
  exportAs: "trMenuTriggerFor",
  inputs: [{ name: "menuTemplateRef", alias: "trMenuTriggerFor" }],
  providers: [{ provide: CdkMenuTrigger, useExisting: forwardRef(() => MenuTriggerDirective) }, PARENT_OR_NEW_MENU_STACK_PROVIDER]
})
export class MenuTriggerDirective extends CdkMenuTrigger {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly parent: Menu | null = inject(CDK_MENU, { optional: true });
  private readonly anchored: AnchoredOverlay = new AnchoredOverlay(inject(Injector), Resources.menuPaneClass);

  public readonly alignment = input<OverlayAlignment>(OverlayAlignment.Start, { alias: "trMenuAlignment" });

  public constructor() {
    super();
    inject(PointerPositionService);
    this.overlayRef = this.anchored.overlayRef;
    this.anchored.originScrolls.pipe(takeUntil(this.destroyed)).subscribe(() => this.menuStack.closeAll());
  }

  public override toggle(): void {
    if (Object.isNull(this.parent))
      super.toggle();
    else
      this.open();
  }

  public override open(): void {
    const wasOpen = this.isOpen();
    super.open();
    if (!wasOpen && this.isOpen())
      this.follow();
  }

  private follow(): void {
    if (Object.isNull(this.parent)) {
      this.anchored.follow(this.host, new OverlayAnchoring(OverlaySide.below, this.alignment(), 0));
      return;
    }
    const panel = this.parent.nativeElement;
    const style = getComputedStyle(panel);
    const offset = -(parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth));
    this.anchored.follow(this.host, new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, offset), () => {
      const row = this.host.getBoundingClientRect();
      const edges = panel.getBoundingClientRect();
      return new DOMRect(edges.left, row.top, edges.width, row.height);
    });
  }
}
