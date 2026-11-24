/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Route } from "@angular/router";

import { DocsPageComponent } from "../../src/app/components/docs-page/docs-page.component";
import { DocsGroup } from "../../src/app/enums/docs-group";
import { DocsPage } from "../../src/app/models/docs-page";
import { SamplePageSection } from "./sample-page-section";

export class SamplePageFixture {
  public static readonly PATH: string = "sample";
  public static readonly LINK: string = "/sample";
  public static readonly TITLE: string = "Sample page";
  public static readonly SECTIONS: readonly SamplePageSection[] = [
    new SamplePageSection("Before you start", 0), new SamplePageSection("What you need", 1), new SamplePageSection("Sign in", 1),
    new SamplePageSection("Your first chat", 0), new SamplePageSection("Add a teammate", 1), new SamplePageSection("Next steps", 0)
  ];
  public static readonly PARAGRAPH: string = "A teammate reads the chat, works in the project's folders and asks before it changes anything outside them, so every step it takes is one you can follow.";
  public static readonly PARAGRAPHS_PER_SECTION: number = 10;
  public static readonly TEXT: string = SamplePageFixture.SECTIONS
    .map(t => [`${"#".repeat(t.depth + 2)} ${t.title}`, ...Array<string>(SamplePageFixture.PARAGRAPHS_PER_SECTION).fill(SamplePageFixture.PARAGRAPH)].join("\n\n"))
    .join("\n\n");
  public static readonly PAGE: DocsPage = new DocsPage(SamplePageFixture.TITLE, SamplePageFixture.PATH, DocsGroup.Start, SamplePageFixture.PATH, SamplePageFixture.TEXT);
  public static readonly ROUTE: Route = { path: SamplePageFixture.PATH, component: DocsPageComponent, title: SamplePageFixture.TITLE, data: { page: SamplePageFixture.PAGE } };

  public static titles(): readonly string[] {
    return SamplePageFixture.SECTIONS.map(t => t.title);
  }

  public static depths(): readonly number[] {
    return SamplePageFixture.SECTIONS.map(t => t.depth);
  }
}
