/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LocationStrategy, TrailingSlashPathLocationStrategy } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ClipboardWriter, CodeBlockComponent } from "@noldova/ui.components.angular";

import { appConfig } from "../../src/app/app.config";
import { BrowserClipboardWriter } from "../../src/app/services/browser-clipboard-writer";
import { DocsFixture } from "../fixtures/docs.fixture";

describe("appConfig", () => {
  it("gives the kit the browser's clipboard, and the site its trailing-slash links", () => {
    expect(appConfig.providers).toContainEqual({ provide: ClipboardWriter, useClass: BrowserClipboardWriter });
    expect(appConfig.providers).toContainEqual({ provide: LocationStrategy, useClass: TrailingSlashPathLocationStrategy });
  });

  it("colors a code block with the kit's highlighter", async () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const fixture = TestBed.createComponent(CodeBlockComponent);
    fixture.componentRef.setInput("code", "const shown: boolean = true;");
    fixture.componentRef.setInput("language", "ts");
    await fixture.whenStable();
    const host = DocsFixture.host(fixture);

    await DocsFixture.untilAsync(() => expect(host.querySelector("pre code span[class^='nol-code-']:not(.nol-code-line)")).not.toBeNull());
  });
});
