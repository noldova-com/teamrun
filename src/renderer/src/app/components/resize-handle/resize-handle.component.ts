/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  type InputSignal,
  type OutputEmitterRef,
  type WritableSignal,
  inject,
  input,
  output,
  signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { PanelEdge } from "../../enums/panel-edge";
import { Resources } from "../../resources";

@Component({
  selector: "tr-resize-handle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tr-resize-handle",
    "[attr.data-edge]": "edge()",
    "[class.tr-resizing]": "isDragging()",
    "[attr.title]": "resources.resizeHandleLabel",
    "(pointerdown)": "start($event)",
    "(pointermove)": "move($event)",
    "(pointerup)": "end($event)",
    "(pointercancel)": "end($event)",
    "(dblclick)": "reset.emit()"
  },
  templateUrl: "./resize-handle.component.html"
})
export class ResizeHandleComponent {
  public readonly edge: InputSignal<PanelEdge> = input.required<PanelEdge>();
  public readonly size: InputSignal<number | null> = input<number | null>(null);
  public readonly resized: OutputEmitterRef<number> = output<number>();
  public readonly reset: OutputEmitterRef<void> = output<void>();
  protected readonly resources: typeof Resources = Resources;
  protected readonly isDragging: WritableSignal<boolean> = signal(false);
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private origin: { position: number; size: number } | null = null;

  protected start(event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    event.preventDefault();
    this.origin = { position: this.positionOf(event), size: this.size() ?? this.measure() };
    this.isDragging.set(true);
    try {
      this.host.nativeElement.setPointerCapture(event.pointerId);
    }
    catch {
    }
  }

  protected move(event: PointerEvent): void {
    if (Object.isNull(this.origin))
      return;
    const delta = (this.positionOf(event) - this.origin.position) * this.direction();
    this.resized.emit(Math.round(this.origin.size + delta));
  }

  protected end(event: PointerEvent): void {
    if (Object.isNull(this.origin))
      return;
    this.origin = null;
    this.isDragging.set(false);
    try {
      this.host.nativeElement.releasePointerCapture(event.pointerId);
    }
    catch {
    }
  }

  private isHorizontal(): boolean {
    return this.edge() === PanelEdge.Left || this.edge() === PanelEdge.Right;
  }

  private direction(): number {
    return this.edge() === PanelEdge.Right || this.edge() === PanelEdge.Bottom ? 1 : -1;
  }

  private positionOf(event: PointerEvent): number {
    return this.isHorizontal() ? event.clientX : event.clientY;
  }

  private measure(): number {
    const panel = this.host.nativeElement.parentElement;
    if (Object.isNull(panel))
      return 0;
    const bounds = panel.getBoundingClientRect();

    return this.isHorizontal() ? bounds.width : bounds.height;
  }
}
