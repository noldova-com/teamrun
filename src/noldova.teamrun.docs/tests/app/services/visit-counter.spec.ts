/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT, PLATFORM_ID, type Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { VisitCounter } from "../../../src/app/services/visit-counter";

describe("VisitCounter", () => {
  let page: Document;

  beforeEach(() => {
    page = document.implementation.createHTMLDocument("");
  });

  const startOn = (hostname: string, providers: readonly Provider[] = []): void => {
    const site = { location: { hostname }, head: page.head, createElement: (tag: string): HTMLElement => page.createElement(tag) };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: site }, ...providers] });
    const counter = TestBed.inject(VisitCounter);
    counter.start();
    counter.start();
  };

  const beacons = (): HTMLScriptElement[] => [...page.head.querySelectorAll("script")];

  it("adds Cloudflare's beacon once on the production docs host, as a classic deferred script with the site's token", () => {
    startOn("teamrun.noldova.dev");
    const shown = beacons();

    expect(shown.map(t => [t.type, t.defer, t.src, t.getAttribute("data-cf-beacon")]))
      .toEqual([["", true, "https://static.cloudflareinsights.com/beacon.min.js", "{\"token\":\"4b8047431bbc42e5961be329dfb3181c\"}"]]);
  });

  for (const hostname of ["teamrun.staging.noldova.dev", "localhost", "noldova.dev", "teamrun.noldova.dev.pages.dev", "teamrun.noldova.dev.example.com", "teamrun.sandbox.noldova.dev"])
    it(`adds no beacon on ${hostname}`, () => {
      startOn(hostname);

      expect(beacons()).toEqual([]);
    });

  it("adds no beacon on the production host while the page renders on the server", () => {
    startOn("teamrun.noldova.dev", [{ provide: PLATFORM_ID, useValue: "server" }]);

    expect(beacons()).toEqual([]);
  });

  it("adds no beacon in the test page, whose own host is local", () => {
    TestBed.inject(VisitCounter).start();

    expect(document.head.querySelector("script[src*='cloudflareinsights']")).toBeNull();
  });
});
