/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, ElementRef, Injector, type Signal, type WritableSignal, afterNextRender, inject, signal, viewChild } from "@angular/core";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { IconButtonComponent, SectionHeaderComponent, TooltipDirective } from "@noldova/ui.components.angular";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import { DocsBrand } from "../../enums/docs-brand";
import { DocsCatalog } from "../../models/docs-catalog";
import type { DocsMenuGroup } from "../../models/docs-menu-group";
import { DocsBrandMarkComponent } from "../docs-brand-mark/docs-brand-mark.component";
import { DocsOnThisPageComponent } from "../docs-on-this-page/docs-on-this-page.component";
import { DocsSearchComponent } from "../docs-search/docs-search.component";
import { DocsThemeSwitchComponent } from "../docs-theme-switch/docs-theme-switch.component";

@Component({
  selector: "nol-docs-root",
  host: {
    class: "nol-docs-root"
  },
  imports: [DocsBrandMarkComponent, DocsOnThisPageComponent, DocsSearchComponent, DocsThemeSwitchComponent, IconButtonComponent, RouterLink, RouterLinkActive, RouterOutlet, SectionHeaderComponent, TooltipDirective],
  templateUrl: "./docs-shell.component.html",
  styleUrl: "./docs-shell.component.css"
})
export class DocsShellComponent {
  private static readonly PAGE_HEADING: string = "main h1";
  private static readonly FOCUS_TARGET_INDEX: number = -1;
  private static readonly HEADER_HEIGHT: string = "--nol-docs-header-height";
  private static readonly PIXELS: string = "px";

  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly router: Router = inject(Router);
  private readonly menuButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("menuButton", { read: ElementRef });
  private readonly header: Signal<ElementRef<HTMLElement>> = viewChild.required("header", { read: ElementRef });
  private isHeadingToFocus: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly brands: typeof DocsBrand = DocsBrand;
  protected readonly groups: readonly DocsMenuGroup[] = DocsCatalog.menuGroups;
  protected readonly isMenuOpen: WritableSignal<boolean> = signal(false);

  public constructor() {
    const navigations = this.router.events.subscribe(event => {
      if (this.isHeadingToFocus && event instanceof NavigationEnd) {
        this.isHeadingToFocus = false;
        this.focusHeadingAfterRender();
      }
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => navigations.unsubscribe());
    afterNextRender(() => {
      const root = this.host.ownerDocument.documentElement;
      const header = this.header().nativeElement;
      const measure = (): void => root.style.setProperty(DocsShellComponent.HEADER_HEIGHT, `${header.getBoundingClientRect().height}${DocsShellComponent.PIXELS}`);
      measure();
      const sizes = new ResizeObserver(measure);
      sizes.observe(header);
      destroyRef.onDestroy(() => {
        sizes.disconnect();
        root.style.removeProperty(DocsShellComponent.HEADER_HEIGHT);
      });
    });
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update(t => !t);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
    this.menuButton().nativeElement.focus();
  }

  protected choosePage(): void {
    if (!this.isMenuOpen())
      return;
    this.isMenuOpen.set(false);
    queueMicrotask(() => {
      if (Object.isNull(this.router.currentNavigation()))
        this.focusHeadingAfterRender();
      else
        this.isHeadingToFocus = true;
    });
  }

  private focusHeadingAfterRender(): void {
    afterNextRender(() => this.focusHeading(), { injector: this.injector });
  }

  private focusHeading(): void {
    for (const heading of this.host.querySelectorAll<HTMLElement>(DocsShellComponent.PAGE_HEADING)) {
      heading.tabIndex = DocsShellComponent.FOCUS_TARGET_INDEX;
      heading.focus();
    }
  }
}
