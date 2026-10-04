/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusMonitor } from "@angular/cdk/a11y";
import { Dialog, type DialogRef } from "@angular/cdk/dialog";
import { OverlayContainer } from "@angular/cdk/overlay";
import type { ComponentType } from "@angular/cdk/portal";
import { DOCUMENT, Injectable, inject } from "@angular/core";

import { DialogTokens } from "../models/dialog-tokens";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class DialogService {
  private static count: number = 0;

  private readonly dialog: Dialog = inject(Dialog);
  private readonly overlays: OverlayContainer = inject(OverlayContainer);
  private readonly focus: FocusMonitor = inject(FocusMonitor);
  private readonly document: Document = inject(DOCUMENT);
  private background: readonly Element[] = [];

  public get isOpen(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  public isTopmost<T>(dialog: DialogRef<unknown, T>): boolean {
    return this.dialog.openDialogs.at(-1) === dialog;
  }

  public open<T>(component: ComponentType<T>, initialFocus: string = Resources.dialogCloseSelector): DialogRef<unknown, T> {
    const titleId = `${Resources.dialogTitleIdPrefix}${DialogService.count++}`;
    const opener = this.document.activeElement as HTMLElement;
    const reference = this.dialog.open<unknown, unknown, T>(component, {
      ariaLabelledBy: titleId,
      ariaModal: true,
      autoFocus: initialFocus,
      restoreFocus: false,
      disableClose: true,
      hasBackdrop: true,
      backdropClass: Resources.dialogBackdropClass,
      panelClass: Resources.dialogPaneClass,
      maxWidth: Resources.noLimit,
      providers: [{ provide: DialogTokens.titleId, useValue: titleId }]
    });
    if (this.dialog.openDialogs.length === 1)
      this.makeBackgroundInert();
    reference.closed.subscribe(() => {
      this.liftInert();
      this.returnFocus(opener);
    });
    return reference;
  }

  private makeBackgroundInert(): void {
    const container = this.overlays.getContainerElement();
    this.background = [...(container.parentElement as HTMLElement).children]
      .filter(t => t !== container && ![Resources.inertAttribute, Resources.ariaLiveAttribute, Resources.popoverAttribute].some(u => t.hasAttribute(u)));
    for (const element of this.background)
      element.setAttribute(Resources.inertAttribute, "");
  }

  private liftInert(): void {
    if (this.isOpen)
      return;
    for (const element of this.background)
      element.removeAttribute(Resources.inertAttribute);
    this.background = [];
  }

  private returnFocus(opener: HTMLElement): void {
    if (this.document.activeElement === this.document.body)
      this.focus.focusVia(opener, Resources.programFocusOrigin);
  }
}
