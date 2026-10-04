/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Dialog, type DialogRef } from "@angular/cdk/dialog";
import type { ComponentType } from "@angular/cdk/portal";
import { Injectable, inject } from "@angular/core";

import { DialogTokens } from "../models/dialog-tokens";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class DialogService {
  private static count: number = 0;

  private readonly dialog: Dialog = inject(Dialog);

  public get isOpen(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  public open<T>(component: ComponentType<T>, initialFocus: string = Resources.dialogCloseSelector): DialogRef<unknown, T> {
    const titleId = `${Resources.dialogTitleIdPrefix}${DialogService.count++}`;
    return this.dialog.open<unknown, unknown, T>(component, {
      ariaLabelledBy: titleId,
      ariaModal: true,
      autoFocus: initialFocus,
      restoreFocus: true,
      disableClose: true,
      hasBackdrop: true,
      backdropClass: Resources.dialogBackdropClass,
      panelClass: Resources.dialogPaneClass,
      maxWidth: Resources.noLimit,
      providers: [{ provide: DialogTokens.titleId, useValue: titleId }]
    });
  }
}
