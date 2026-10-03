/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { EditAction } from "../enums/edit-action";
import { EditTarget } from "../models/edit-target";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class EditTargetService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly targetValue: WritableSignal<EditTarget | null> = signal(null);

  public readonly target: Signal<EditTarget | null> = this.targetValue.asReadonly();

  public constructor() {
    this.document.addEventListener(Resources.focusInEvent, event => this.follow(event.target), true);
    this.document.addEventListener(Resources.focusOutEvent, event => this.keep(event.target), true);
  }

  public canRun(action: EditAction): boolean {
    const target = this.targetValue();
    if (Object.isNull(target) || !target.element.isConnected)
      return false;
    switch (action) {
      case EditAction.Copy:
        return target.hasSelection;
      case EditAction.Cut:
        return target.hasSelection && target.isWritable;
      case EditAction.SelectAll:
        return true;
      default:
        return target.isWritable;
    }
  }

  public async restoreAsync(): Promise<boolean> {
    await Promise.resolve();
    const target = this.targetValue();
    if (Object.isNull(target) || !target.element.isConnected)
      return false;
    target.restore(this.document);
    return true;
  }

  private follow(element: EventTarget | null): void {
    if (!(element instanceof HTMLElement) || !Object.isNull(element.closest(Resources.transientFocusSelector)))
      return;
    this.targetValue.set(EditTarget.isEditable(element) ? EditTarget.capture(element, this.document) : null);
  }

  private keep(element: EventTarget | null): void {
    const target = this.targetValue();
    if (!Object.isNull(target) && element === target.element)
      this.targetValue.set(EditTarget.capture(target.element, this.document));
  }
}
