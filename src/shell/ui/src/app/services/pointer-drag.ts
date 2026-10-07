/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";

export class PointerDrag {
  private readonly element: HTMLElement;
  private readonly pointerId: number;
  private isStarted: boolean = false;
  private stopListening: (() => void) | null;

  public constructor(element: HTMLElement, press: PointerEvent, move: (event: PointerEvent) => void, end: () => void, cancel: () => void) {
    this.element = element;
    this.pointerId = press.pointerId;
    const document = element.ownerDocument;
    const isOwn = (event: PointerEvent): boolean => event.pointerId === this.pointerId;
    const onMove = (event: PointerEvent): void => {
      if (!isOwn(event))
        return;
      if ((event.buttons & Resources.primaryButtons) === 0)
        cancel();
      else
        move(event);
    };
    const onUp = (event: PointerEvent): void => {
      if (isOwn(event))
        end();
    };
    const onLost = (event: PointerEvent): void => {
      if (isOwn(event))
        cancel();
    };
    const onBlur = (): void => cancel();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== Resources.escapeKey || !this.isStarted)
        return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    document.addEventListener(Resources.pointermoveEvent, onMove);
    document.addEventListener(Resources.pointerupEvent, onUp);
    document.addEventListener(Resources.pointercancelEvent, onLost);
    element.addEventListener(Resources.lostpointercaptureEvent, onLost);
    document.addEventListener(Resources.keydownEvent, onKey, { capture: true });
    window.addEventListener(Resources.blurEvent, onBlur);
    this.stopListening = () => {
      document.removeEventListener(Resources.pointermoveEvent, onMove);
      document.removeEventListener(Resources.pointerupEvent, onUp);
      document.removeEventListener(Resources.pointercancelEvent, onLost);
      element.removeEventListener(Resources.lostpointercaptureEvent, onLost);
      document.removeEventListener(Resources.keydownEvent, onKey, { capture: true });
      window.removeEventListener(Resources.blurEvent, onBlur);
    };
  }

  public start(): void {
    this.isStarted = true;
    this.element.setPointerCapture(this.pointerId);
  }

  public stop(): void {
    this.stopListening?.();
    this.stopListening = null;
    if (this.element.hasPointerCapture(this.pointerId))
      this.element.releasePointerCapture(this.pointerId);
  }
}
