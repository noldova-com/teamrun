/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DOCUMENT, DestroyRef, ElementRef, Injector, type Signal, type WritableSignal, afterNextRender, computed, effect, inject, signal, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { SectionHeaderComponent, SiteFooterComponent, SiteHeaderComponent, SiteLink, SiteLinkGroup, SiteSearchDirective, SiteSocialLink }
  from "@noldova/ui.components.angular";
import { filter, map } from "rxjs";

import "@noldova/context.core";

import { releasedVersion } from "@docs-generated/release";

import { Resources } from "../../../resources";
import { DocsCatalog } from "../../models/docs-catalog";
import type { DocsMenuGroup } from "../../models/docs-menu-group";
import { DocsOnThisPageComponent } from "../docs-on-this-page/docs-on-this-page.component";
import { DocsPagesBarComponent } from "../docs-pages-bar/docs-pages-bar.component";
import { DocsSearchComponent } from "../docs-search/docs-search.component";

@Component({
  selector: "nol-docs-root",
  host: {
    class: "nol-docs-root"
  },
  imports: [DocsOnThisPageComponent, DocsPagesBarComponent, DocsSearchComponent, RouterLink, RouterLinkActive, RouterOutlet, SectionHeaderComponent, SiteFooterComponent, SiteHeaderComponent,
    SiteSearchDirective],
  templateUrl: "./docs-shell.component.html",
  styleUrl: "./docs-shell.component.css"
})
export class DocsShellComponent {
  private static readonly PAGE_HEADING: string = "main h1";
  private static readonly FOCUS_TARGET_INDEX: number = -1;
  private static readonly HEADER_HEIGHT: string = "--nol-docs-header-height";
  private static readonly PIXELS: string = "px";
  private static readonly LINK: string = "a";
  private static readonly ADDRESS_END: RegExp = /[?#]/u;
  private static readonly PRIMARY_BUTTON: number = 0;
  private static readonly ROOT: string = "/";

  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document: Document = inject(DOCUMENT);
  private readonly injector: Injector = inject(Injector);
  private readonly router: Router = inject(Router);
  private readonly pagesBarButton: Signal<DocsPagesBarComponent> = viewChild.required(DocsPagesBarComponent);
  private readonly header: Signal<ElementRef<HTMLElement>> = viewChild.required("header", { read: ElementRef });
  private readonly pagesBar: Signal<ElementRef<HTMLElement>> = viewChild.required("pagesBar", { read: ElementRef });
  private readonly path: Signal<string> = toSignal(this.router.events.pipe(filter(t => t instanceof NavigationEnd), map(() => DocsShellComponent.pathOf(this.router.url))),
    { initialValue: DocsShellComponent.pathOf(this.router.url) });
  private isHeadingToFocus: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly groups: readonly DocsMenuGroup[] = DocsCatalog.menuGroups;
  protected readonly version: string = Resources.formatVersion(releasedVersion);
  protected readonly releaseNotesLink: string = DocsCatalog.releaseNotes.link;
  protected readonly isMenuOpen: WritableSignal<boolean> = signal(false);
  protected readonly isSiteMenuOpen: WritableSignal<boolean> = signal(false);
  protected readonly isSearchOpen: WritableSignal<boolean> = signal(false);
  protected readonly social: readonly SiteSocialLink[] = [
    new SiteSocialLink(Resources.repositoryLabel, Resources.repositoryLink, Resources.repositoryIcon),
    new SiteSocialLink(Resources.xLabel, Resources.xLink, Resources.xIcon)
  ];
  protected readonly links: Signal<readonly SiteLink[]> = computed(() => [
    new SiteLink(Resources.websiteLabel, Resources.websiteLink),
    new SiteLink(Resources.releaseNotesTitle, this.releaseNotesLink, this.path() === this.releaseNotesLink)
  ]);
  protected readonly footerGroups: Signal<readonly SiteLinkGroup[]> = computed(() => [
    new SiteLinkGroup(Resources.productGroupLabel, [
      new SiteLink(Resources.websiteFooterLabel, Resources.websiteLink),
      new SiteLink(Resources.downloadLabel, Resources.downloadLink),
      new SiteLink(Resources.releaseNotesTitle, this.releaseNotesLink, this.path() === this.releaseNotesLink)
    ]),
    new SiteLinkGroup(Resources.helpGroupLabel, [new SiteLink(Resources.feedbackLabel, Resources.feedbackLink), new SiteLink(Resources.privacyLabel, Resources.privacyLink)]),
    new SiteLinkGroup(Resources.followGroupLabel, this.social.map(t => new SiteLink(t.label, t.href)))
  ]);

  public constructor() {
    const navigations = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd)
        this.isSearchOpen.set(false);
      if (this.isHeadingToFocus && event instanceof NavigationEnd) {
        this.isHeadingToFocus = false;
        this.focusHeadingAfterRender();
      }
    });
    effect(() => {
      if (this.isSiteMenuOpen() || this.isSearchOpen())
        this.isMenuOpen.set(false);
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => navigations.unsubscribe());
    afterNextRender(() => {
      const root = this.host.ownerDocument.documentElement;
      const header = this.header().nativeElement;
      const bar = this.pagesBar().nativeElement;
      const measure = (): void => root.style.setProperty(DocsShellComponent.HEADER_HEIGHT,
        `${header.getBoundingClientRect().height + bar.getBoundingClientRect().height}${DocsShellComponent.PIXELS}`);
      measure();
      const sizes = new ResizeObserver(measure);
      sizes.observe(header);
      sizes.observe(bar);
      destroyRef.onDestroy(() => {
        sizes.disconnect();
        root.style.removeProperty(DocsShellComponent.HEADER_HEIGHT);
      });
    });
  }

  protected toggleMenu(isOpen: boolean): void {
    this.isMenuOpen.set(isOpen);
    if (isOpen) {
      this.isSiteMenuOpen.set(false);
      this.isSearchOpen.set(false);
    }
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
    this.pagesBarButton().focus();
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

  protected followLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== DocsShellComponent.PRIMARY_BUTTON || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(DocsShellComponent.LINK) : null;
    if (Object.isNull(link) || link.target !== String.empty || link.origin !== this.document.location.origin)
      return;
    if (link.pathname === this.document.location.pathname && link.hash !== String.empty)
      return;
    event.preventDefault();
    void this.router.navigateByUrl(DocsShellComponent.pathOf(link.pathname) + link.search + link.hash);
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

  private static pathOf(url: string): string {
    const end = url.search(DocsShellComponent.ADDRESS_END);
    const path = end < 0 ? url : url.slice(0, end);
    return path.length > DocsShellComponent.ROOT.length && path.endsWith(DocsShellComponent.ROOT) ? path.slice(0, -DocsShellComponent.ROOT.length) : path;
  }
}
