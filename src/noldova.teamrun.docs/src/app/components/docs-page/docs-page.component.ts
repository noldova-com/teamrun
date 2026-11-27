/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject, input } from "@angular/core";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";
import { SiteStageService } from "@noldova/ui.components.angular/site";

import { Resources } from "../../../resources";

import type { DocsPage } from "../../models/docs-page";
import { DocsLinksDirective } from "../docs-links/docs-links.directive";

@Component({
  selector: "nol-docs-page",
  imports: [DocsLinksDirective, MarkdownViewComponent],
  templateUrl: "./docs-page.component.html"
})
export class DocsPageComponent {
  private static readonly LINK: RegExp = /\]\((https:\/\/[^)\s]+)\)/gu;

  private readonly stage: SiteStageService = inject(SiteStageService);

  public readonly page = input.required<DocsPage>();

  protected readonly text: Signal<string> = computed(() => this.page().text.replace(DocsPageComponent.LINK, (link: string, href: string) =>
    href.startsWith(Resources.siteLink) ? link : `](${this.stage.address(href)})`));
}
