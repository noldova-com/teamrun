/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ErrorHandler, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, effect, inject, signal, viewChild } from "@angular/core";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, DialogService, IconButtonComponent, MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, OverlaySide, TooltipDirective } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../../resources";
import { MenuBarStyle } from "../../enums/menu-bar-style";
import { WindowAppearance } from "../../models/window-appearance";
import type { DocumentHeading } from "../../models/document-heading";
import { DocumentTab } from "../../models/layout/document-tab";
import { BarItemsService } from "../../services/bar-items.service";
import { CommandService } from "../../services/command.service";
import { DesktopBridgeService } from "../../services/desktop-bridge.service";
import { LayoutService } from "../../services/layout.service";
import { MenuBarService } from "../../services/menu-bar.service";
import { SettingsService } from "../../services/settings.service";
import { TabLabelService } from "../../services/tab-label.service";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";

@Component({
  selector: "tr-window-row",
  imports: [IconButtonComponent, MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, NgTemplateOutlet, PlaceMenuComponent, TooltipDirective],
  templateUrl: "./window-row.component.html",
  styleUrl: "./window-row.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-tr-chrome": "top",
    "[class.tr-window-row-mac]": "isMac",
    "(document:keydown)": "pressed($event)",
    "(document:keyup)": "released($event)",
    "(document:pointerdown)": "pointed()"
  }
})
export class WindowRowComponent {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly foldedValue: WritableSignal<boolean> = signal(false);
  private readonly bar: Signal<ElementRef<HTMLElement> | undefined> = viewChild("bar", { read: ElementRef });
  private readonly menuButton: Signal<ElementRef<HTMLElement> | undefined> = viewChild("menuButton", { read: ElementRef });
  private readonly start: Signal<ElementRef<HTMLElement> | undefined> = viewChild("start", { read: ElementRef });
  private readonly end: Signal<ElementRef<HTMLElement> | undefined> = viewChild("end", { read: ElementRef });
  private returnFocus: HTMLElement | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly isMac: boolean = this.bridge.isMac;
  protected readonly bars: BarItemsService = inject(BarItemsService);
  protected readonly menuBar: MenuBarService = inject(MenuBarService);
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly heading: Signal<DocumentHeading | null> = computed(() => {
    const active = this.layout.layout().documents.active;
    return active instanceof DocumentTab ? this.labels.headingOf(active) : null;
  });
  protected readonly isFolded: Signal<boolean> = this.foldedValue.asReadonly();
  protected readonly style: Signal<MenuBarStyle> = computed(() => {
    const value = this.settings.values().get(Resources.menuBarSetting);
    return value === MenuBarStyle.Button || value === MenuBarStyle.Hidden ? value : MenuBarStyle.Inline;
  });
  protected readonly isBarShown: Signal<boolean> = computed(() => !this.isMac && this.style() === MenuBarStyle.Inline && this.menuBar.shownPlaces().length > 0);
  protected readonly isButtonShown: Signal<boolean> = computed(() =>
    !this.isMac && this.menuBar.shownPlaces().length > 0 && (this.style() === MenuBarStyle.Button || (this.style() === MenuBarStyle.Inline && this.isFolded())));

  private isAltAlone: boolean = false;

  public constructor() {
    const host = this.host;
    const appearance = inject(AppearanceService);
    let isReported = false;
    afterNextRender(() => this.bridge.notifyReady(WindowAppearance.read(host)));
    afterRenderEffect(() => {
      appearance.theme();
      appearance.mode();
      if (isReported)
        this.bridge.notifyAppearance(WindowAppearance.read(host));
      isReported = true;
    });
    effect(() => {
      host.ownerDocument.title = this.heading()?.windowTitle ?? Resources.productName;
    });
    const observer = new ResizeObserver(() => this.measure());
    afterRenderEffect(() => {
      observer.disconnect();
      for (const element of [host, this.bar()?.nativeElement, this.start()?.nativeElement, this.end()?.nativeElement])
        if (!Object.isUndefined(element))
          observer.observe(element);
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    if (this.isMac) {
      effect(() => this.bridge.setMenuBar(this.menuBar.tree()));
      inject(DestroyRef).onDestroy(this.bridge.onMenuCommand(t => this.menuBar.run(t)));
    }
  }

  protected pressed(event: KeyboardEvent): void {
    this.isAltAlone = event.key === Resources.altKey && !event.repeat;
    if (event.key === Resources.functionKey && !event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey)
      this.focusMenu(event);
    else if (event.key === Resources.escapeKey && this.isReturnable(event.target))
      this.giveFocusBack(event);
  }

  protected pointed(): void {
    this.isAltAlone = false;
  }

  protected released(event: KeyboardEvent): void {
    const isAlone = this.isAltAlone && event.key === Resources.altKey;
    this.isAltAlone = false;
    if (isAlone)
      this.focusMenu(event);
  }

  protected isAvailable(command: string, commandArguments: JsonValue): boolean {
    return this.commands.isAvailable(command, commandArguments);
  }

  protected run(command: string, commandArguments: JsonValue): void {
    this.commands.runAsync(command, commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }

  private focusMenu(event: Event): void {
    const target = this.isFolded() || this.style() !== MenuBarStyle.Inline
      ? this.menuButton()?.nativeElement
      : this.bar()?.nativeElement.querySelector<HTMLElement>(Resources.menuBarItemSelector);
    if (Object.isUndefined(target) || Object.isNull(target) || this.isMac || this.dialogs.isOpen)
      return;

    event.preventDefault();
    const active = this.host.ownerDocument.activeElement;
    if (!this.host.contains(active))
      this.returnFocus = active as HTMLElement | null;
    target.focus();
  }

  private isReturnable(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && this.host.contains(target) && target.getAttribute(Resources.ariaExpandedAttribute) !== Resources.trueValue && !Object.isNull(this.returnFocus);
  }

  private giveFocusBack(event: Event): void {
    event.preventDefault();
    const target = this.returnFocus as HTMLElement;
    this.returnFocus = null;
    if (target.isConnected)
      target.focus();
  }

  private measure(): void {
    const bar = this.bar()?.nativeElement;
    const start = this.start()?.nativeElement;
    const end = this.end()?.nativeElement;
    if (Object.isUndefined(bar) || Object.isUndefined(start) || Object.isUndefined(end)) {
      this.foldedValue.set(false);
      return;
    }

    const style = getComputedStyle(this.host);
    const dragWidth = Resources.windowRowMinimumDragRem * parseFloat(getComputedStyle(this.host.ownerDocument.documentElement).fontSize);
    const room = this.host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - start.offsetWidth - end.offsetWidth - dragWidth;
    this.foldedValue.set(bar.offsetWidth > room);
  }
}
