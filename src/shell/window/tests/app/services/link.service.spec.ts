/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";
import { LinkService } from "../../../src/app/services/link.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("LinkService", () => {
  let bridge: DesktopBridgeFixture;
  let errors: unknown[];
  let content: HTMLElement;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    errors = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }]
    });
    content = document.createElement("div");
    content.innerHTML = [
      "<a class=\"docs\" href=\"https://example.com/docs\"><span>Docs</span></a>",
      "<a class=\"mail\" href=\"mailto:support@example.com\">Mail</a>",
      "<a class=\"local\" href=\"file:///etc/passwd\">Local</a>",
      "<a class=\"top\" href=\"#top\">Top</a>",
      "<a class=\"bare\">Bare</a>",
      "<button class=\"other\" type=\"button\">Other</button>"
    ].join("");
    document.body.append(content);
  });

  afterEach(() => {
    content.remove();
    DesktopBridgeFixture.remove();
  });

  function click(selector: string, type: string = "click", button: number = 0): boolean {
    const target = content.querySelector(selector) ?? content;
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it("opens a link clicked in the window's content through the desktop, also with the middle button, and leaves in-page links, other buttons and other elements alone", async () => {
    const stop = TestBed.inject(LinkService).listen();

    const prevented = [
      click(".docs span"),
      click(".mail", "auxclick", 1),
      click(".docs", "auxclick", 2),
      click(".top"),
      click(".bare"),
      click(".other")
    ];
    await Promise.resolve();

    expect(prevented).toEqual([true, true, false, false, false, false]);
    expect(bridge.links).toEqual(["https://example.com/docs", "mailto:support@example.com"]);
    expect(errors).toEqual([]);
    stop();
  });

  it("leaves a click a window part already handled, and stops listening once stopped", () => {
    const stop = TestBed.inject(LinkService).listen();
    const handled = content.querySelector(".mail");
    handled?.addEventListener("click", t => t.preventDefault());

    const handledPrevented = click(".mail");
    stop();
    const prevented = click(".mail", "auxclick", 1);

    expect([handledPrevented, prevented, bridge.links]).toEqual([true, false, []]);
  });

  it("reports a link the desktop does not open", async () => {
    bridge.isLinkOpened = false;
    const stop = TestBed.inject(LinkService).listen();

    const prevented = click(".local");
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect([prevented, bridge.links]).toEqual([true, ["file:///etc/passwd"]]);
    expect([errors[0] instanceof LinkNotOpenedException, (errors[0] as Error).message])
      .toEqual([true, "TeamRun did not open the link: it opens only well-formed http, https and mailto links, in the system's own application."]);
    stop();
  });
});
