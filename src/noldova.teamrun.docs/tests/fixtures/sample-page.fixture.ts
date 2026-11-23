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

export class SamplePageFixture {
  public static readonly PATH: string = "sample";
  public static readonly LINK: string = "/sample";
  public static readonly TITLE: string = "Sample page";
  public static readonly SECTIONS: readonly (readonly [title: string, depth: number])[] = [
    ["Before you start", 0], ["What you need", 1], ["Sign in", 1], ["Your first chat", 0], ["Add a teammate", 1], ["Next steps", 0]
  ];
  public static readonly PARAGRAPH: string = "A teammate reads the chat, works in the project's folders and asks before it changes anything outside them, so every step it takes is one you can follow.";
  public static readonly PARAGRAPHS_PER_SECTION: number = 10;
  public static readonly TEXT: string = SamplePageFixture.SECTIONS
    .map(([title, depth]) => [`${"#".repeat(depth + 2)} ${title}`, ...Array<string>(SamplePageFixture.PARAGRAPHS_PER_SECTION).fill(SamplePageFixture.PARAGRAPH)].join("\n\n"))
    .join("\n\n");
  public static readonly PAGE: DocsPage = new DocsPage(SamplePageFixture.TITLE, SamplePageFixture.PATH, DocsGroup.Start, SamplePageFixture.PATH, SamplePageFixture.TEXT);
  public static readonly ROUTE: Route = { path: SamplePageFixture.PATH, component: DocsPageComponent, title: SamplePageFixture.TITLE, data: { page: SamplePageFixture.PAGE } };

  public static titles(): readonly string[] {
    return SamplePageFixture.SECTIONS.map(([title]) => title);
  }

  public static depths(): readonly number[] {
    return SamplePageFixture.SECTIONS.map(([, depth]) => depth);
  }
}
