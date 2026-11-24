/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DOCUMENT, DestroyRef, type WritableSignal, afterNextRender, inject, input, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink } from "@angular/router";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import { DocsOutline } from "../../models/docs-outline";
import type { DocsOutlineEntry } from "../../models/docs-outline-entry";

@Component({
  selector: "nol-docs-on-this-page",
  imports: [RouterLink],
  templateUrl: "./docs-on-this-page.component.html",
  styleUrl: "./docs-on-this-page.component.css"
})
export class DocsOnThisPageComponent {
  private static readonly READING_EDGE: number = 1;
  private static readonly END_SLACK: number = 1;
  private static readonly READER_INPUTS: readonly string[] = ["wheel", "keydown", "pointerdown", "touchstart"];

  private readonly document: Document = inject(DOCUMENT);
  private readonly router: Router = inject(Router);
  private fragmentToReach: string | null = null;
  private heldHeading: HTMLElement | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly entries: WritableSignal<readonly DocsOutlineEntry[]> = signal([]);
  protected readonly current: WritableSignal<DocsOutlineEntry | null> = signal(null);
  protected readonly pageLink: WritableSignal<string> = signal(Resources.homeLink);

  public readonly content = input.required<HTMLElement>();

  public constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const refresh = (): void => this.refresh();
      const markCurrent = (): void => this.markCurrent();
      const release = (): void => {
        this.heldHeading = null;
      };
      const observer = new MutationObserver(refresh);
      observer.observe(this.content(), { childList: true, subtree: true, characterData: true });
      const sizes = new ResizeObserver(refresh);
      sizes.observe(this.content());
      this.document.fonts.addEventListener("loadingdone", refresh);
      this.document.addEventListener("scroll", markCurrent, { passive: true });
      for (const name of DocsOnThisPageComponent.READER_INPUTS)
        this.document.addEventListener(name, release, { capture: true, passive: true });
      const navigations = this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd)
          this.arrive(event.urlAfterRedirects);
      });
      destroyRef.onDestroy(() => {
        observer.disconnect();
        sizes.disconnect();
        this.document.fonts.removeEventListener("loadingdone", refresh);
        this.document.removeEventListener("scroll", markCurrent);
        for (const name of DocsOnThisPageComponent.READER_INPUTS)
          this.document.removeEventListener(name, release, { capture: true });
        navigations.unsubscribe();
      });
      this.arrive(this.router.url);
    });
  }

  protected follow(entry: DocsOutlineEntry): void {
    this.fragmentToReach = entry.id;
    this.reachFragment();
  }

  private arrive(url: string): void {
    const tree = this.router.parseUrl(url);
    this.fragmentToReach = tree.fragment;
    this.heldHeading = null;
    tree.fragment = null;
    this.pageLink.set(this.router.serializeUrl(tree));
    this.refresh();
  }

  private refresh(): void {
    this.entries.set(DocsOutline.read(this.content()));
    this.heldHeading?.scrollIntoView();
    this.reachFragment();
    this.markCurrent();
  }

  private reachFragment(): void {
    const entry = this.entries().find(t => t.id === this.fragmentToReach);
    if (Object.isUndefined(entry))
      return;
    this.fragmentToReach = null;
    this.heldHeading = entry.heading;
    entry.heading.scrollIntoView();
  }

  private markCurrent(): void {
    const root = this.document.documentElement;
    const isAtEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - DocsOnThisPageComponent.END_SLACK;
    const readingEdge = parseFloat(getComputedStyle(root).scrollPaddingBlockStart) + DocsOnThisPageComponent.READING_EDGE;
    this.current.set(DocsOutline.currentOf(this.entries(), readingEdge, isAtEnd, root.clientHeight));
  }
}
