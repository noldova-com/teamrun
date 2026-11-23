/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT, Location } from "@angular/common";
import { Directive, inject } from "@angular/core";
import { Router } from "@angular/router";
import { LinkGesture, type LinkOpenEvent } from "@noldova/ui.components.angular";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import { Resources } from "../../../resources";

@Directive({
  selector: "nol-markdown-view[nolDocsLinks]"
})
export class DocsLinksDirective {
  private static readonly NEW_TAB: string = "_blank";
  private static readonly NO_OPENER: string = "noopener";
  private static readonly SITE_PAGE: RegExp = /^([a-z0-9-]*)\/?(?:#(.+))?$/u;

  private readonly router: Router = inject(Router);
  private readonly location: Location = inject(Location);
  private readonly window: Window | null = inject(DOCUMENT).defaultView;

  public constructor() {
    inject(MarkdownViewComponent).linkOpen.subscribe(link => this.open(link));
  }

  private open(link: LinkOpenEvent): void {
    const page = this.pageOf(link.url);
    if (page !== null && link.gesture === LinkGesture.Plain) {
      void this.router.navigateByUrl(page).then(isDone => {
        if (isDone && !page.includes("#"))
          this.window?.scrollTo(0, 0);
      });
      return;
    }
    this.window?.open(page === null ? link.url : this.location.prepareExternalUrl(page), DocsLinksDirective.NEW_TAB, DocsLinksDirective.NO_OPENER);
  }

  private pageOf(url: string): string | null {
    if (!url.startsWith(Resources.siteLink))
      return null;
    const match = DocsLinksDirective.SITE_PAGE.exec(url.slice(Resources.siteLink.length));
    if (match === null)
      return null;
    const [, path, anchor] = match;
    if (!this.router.config.some(t => t.path === path))
      return null;
    return anchor === undefined ? `/${path}` : `/${path}#${anchor}`;
  }
}
