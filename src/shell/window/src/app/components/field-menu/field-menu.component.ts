/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, type Signal, type WritableSignal, inject, signal, viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { ContextMenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { EditTarget } from "../../models/edit-target";
import type { FieldMenuRequest } from "../../models/field-menu-request";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-field-menu",
  imports: [ContextMenuTriggerDirective, PlaceMenuComponent],
  templateUrl: "./field-menu.component.html",
  styleUrl: "./field-menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:contextmenu)": "noteFromPointer($event)",
    "(document:keydown)": "noteFromKeyboard($event)"
  }
})
export class FieldMenuComponent {
  private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private pending: readonly [HTMLElement, MouseEvent | KeyboardEvent] | null = null;
  private wait: ReturnType<typeof setTimeout> | undefined;

  protected readonly resources: typeof Resources = Resources;
  protected readonly context: WritableSignal<JsonObject> = signal({});

  public constructor() {
    const stop = this.bridge.onFieldMenu(t => this.answer(t));
    inject(DestroyRef).onDestroy(() => {
      stop();
      clearTimeout(this.wait);
    });
  }

  protected noteFromPointer(event: MouseEvent): void {
    const field = FieldMenuComponent.targetOf(event);
    if (Object.isNull(field) || (this.pending?.[0] === field && this.pending[1] instanceof KeyboardEvent))
      return;
    this.note(field, event);
  }

  protected noteFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== Resources.contextMenuKey && !(event.key === Resources.functionKey && event.shiftKey))
      return;
    const field = FieldMenuComponent.targetOf(event);
    if (Object.isNull(field))
      return;
    this.note(field, event);
    if (this.bridge.isMac)
      this.open(null);
  }

  private note(field: HTMLElement, event: MouseEvent | KeyboardEvent): void {
    clearTimeout(this.wait);
    this.pending = [field, event];
    this.wait = setTimeout(() => this.open(null), Resources.fieldMenuWait);
  }

  private answer(request: FieldMenuRequest): void {
    const event = this.pending?.[1];
    if (Object.isUndefined(event) || request.isKeyboard !== event instanceof KeyboardEvent)
      return;
    if (event instanceof MouseEvent && (Math.abs(request.x - event.clientX) > Resources.fieldMenuSlack || Math.abs(request.y - event.clientY) > Resources.fieldMenuSlack))
      return;
    this.open(request);
  }

  private open(request: FieldMenuRequest | null): void {
    clearTimeout(this.wait);
    const pending = this.pending;
    this.pending = null;
    if (Object.isNull(pending) || !pending[0].isConnected)
      return;
    const [field, event] = pending;
    this.context.set(request?.toContext() ?? {});
    if (event instanceof KeyboardEvent)
      this.trigger().openFromKeyboard(event, field);
    else
      this.trigger().openAtPointer(event, field);
  }

  private static targetOf(event: Event): HTMLElement | null {
    const element = event.target;
    if (event.defaultPrevented || !(element instanceof HTMLElement) || !Object.isNull(element.closest(Resources.transientFocusSelector)))
      return null;
    return EditTarget.fieldOf(element);
  }
}
