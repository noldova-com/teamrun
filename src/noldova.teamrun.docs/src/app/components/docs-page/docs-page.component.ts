/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input } from "@angular/core";
import { MarkdownViewComponent } from "@noldova/ui.components.angular/markdown";

import type { DocsPage } from "../../models/docs-page";
import { DocsLinksDirective } from "../docs-links/docs-links.directive";

@Component({
  selector: "nol-docs-page",
  imports: [DocsLinksDirective, MarkdownViewComponent],
  templateUrl: "./docs-page.component.html"
})
export class DocsPageComponent {
  public readonly page = input.required<DocsPage>();
}
