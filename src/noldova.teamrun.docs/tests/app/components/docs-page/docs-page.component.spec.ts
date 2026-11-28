/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import "@noldova/context.core";

import { DocsPageComponent } from "../../../../src/app/components/docs-page/docs-page.component";
import { DocsCatalog } from "../../../../src/app/models/docs-catalog";
import { Resources } from "../../../../src/resources";
import { DocsFixture } from "../../../fixtures/docs.fixture";

describe("DocsPageComponent", () => {
  const home = DocsCatalog.home;
  const linkCount = (home.text.match(/\]\(https:\/\//gu) ?? []).length;

  const linksAsync = async (providers: readonly Provider[]): Promise<readonly (string | null)[]> => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideMarkdown(), ...providers] });
    const fixture = TestBed.createComponent(DocsPageComponent);
    fixture.componentRef.setInput("page", home);
    await fixture.whenStable();
    const host = DocsFixture.host(fixture);
    await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, "a.nol-markdown-link").length).toBe(linkCount));
    return DocsFixture.all(host, "a.nol-markdown-link").map(t => t.getAttribute("href"));
  };

  afterEach(() => DocsFixture.resetAsync());

  it("links the website at production as the page writes it", async () => {
    const links = await linksAsync([]);

    expect([links.includes("https://teamrun.noldova.com/download/"), links.includes(`${Resources.siteLink}getting-started`), links.includes(Resources.repositoryLink)])
      .toEqual([true, true, true]);
  });

  for (const stage of ["sandbox", "staging"] as const)
    it(`links the website at the ${stage} stage, and the docs site's own pages and TeamRun's repository as the page writes them`, async () => {
      const links = await linksAsync([DocsFixture.stageAt(`teamrun.${stage}.noldova.dev`)]);

      expect([links.includes(`https://teamrun.${stage}.noldova.com/download/`), links.includes(`${Resources.siteLink}getting-started`), links.includes(Resources.repositoryLink),
        links.some(t => t?.startsWith("https://teamrun.noldova.com") ?? false)]).toEqual([true, true, true, false]);
    });
});
