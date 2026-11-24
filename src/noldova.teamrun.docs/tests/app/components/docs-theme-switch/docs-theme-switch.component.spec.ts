/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { indexPage } from "@docs-generated/index-page";
import { userEvent } from "vitest/browser";

import { DocsThemeSwitchComponent } from "../../../../src/app/components/docs-theme-switch/docs-theme-switch.component";
import { DocsFixture } from "../../../fixtures/docs.fixture";

describe("DocsThemeSwitchComponent", () => {
  const renderAsync = async (): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(DocsThemeSwitchComponent);
    await fixture.whenStable();
    return DocsFixture.host(fixture);
  };

  const checked = (host: HTMLElement): readonly (string | undefined)[] =>
    DocsFixture.all(host, "[role=radio]").filter(t => t.getAttribute("aria-checked") === "true").map(t => t.textContent?.trim());

  const modeBeforeBodyAsync = async (stored: string): Promise<unknown> => {
    localStorage.setItem(DocsFixture.STORAGE_KEY, stored);
    const frame = document.createElement("iframe");
    let listener: (event: MessageEvent) => void = () => undefined;
    const answer = new Promise<unknown>(resolve => {
      listener = event => {
        if (event.source === frame.contentWindow)
          resolve(event.data);
      };
    });
    window.addEventListener("message", listener);
    const probe = `<script>window.parent.postMessage(document.documentElement.getAttribute("${DocsFixture.MODE_ATTRIBUTE}"), "*");</script>`;
    frame.srcdoc = indexPage.replace("<body>", `<body>${probe}`);
    document.body.append(frame);
    try {
      return await answer;
    }
    finally {
      window.removeEventListener("message", listener);
      frame.remove();
    }
  };

  afterEach(async () => {
    vi.restoreAllMocks();
    await DocsFixture.resetAsync();
  });

  it("starts on System when nothing chose a mode", async () => {
    const host = await renderAsync();

    expect(checked(host)).toEqual(["System"]);
  });

  it("paints the chosen mode on the page's root and keeps it for the next visit", async () => {
    const host = await renderAsync();

    await userEvent.click(DocsFixture.byText(host, "[role=radio]", "Dark"));
    await DocsFixture.untilAsync(() => expect(checked(host)).toEqual(["Dark"]));
    expect(document.documentElement.getAttribute(DocsFixture.MODE_ATTRIBUTE)).toBe("Dark");
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("dark");
    expect(localStorage.getItem(DocsFixture.STORAGE_KEY)).toBe("Dark");

    await userEvent.click(DocsFixture.byText(host, "[role=radio]", "System"));
    await DocsFixture.untilAsync(() => expect(checked(host)).toEqual(["System"]));
    expect(document.documentElement.getAttribute(DocsFixture.MODE_ATTRIBUTE)).toBeNull();
    expect(localStorage.getItem(DocsFixture.STORAGE_KEY)).toBeNull();
  });

  it("still paints the chosen mode when the browser refuses to keep it", async () => {
    const keep = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Refused.", "SecurityError");
    });
    const host = await renderAsync();

    await userEvent.click(DocsFixture.byText(host, "[role=radio]", "Dark"));

    await DocsFixture.untilAsync(() => expect(checked(host)).toEqual(["Dark"]));
    expect(document.documentElement.getAttribute(DocsFixture.MODE_ATTRIBUTE)).toBe("Dark");
    expect(keep).toHaveBeenCalledWith(DocsFixture.STORAGE_KEY, "Dark");
  });

  it("passes on a failure to keep the mode that is not the browser's refusal", async () => {
    const handleError = vi.fn<(error: unknown) => void>();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError } }] });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new TypeError("Broken.");
    });
    const host = await renderAsync();

    await userEvent.click(DocsFixture.byText(host, "[role=radio]", "Dark"));

    await DocsFixture.untilAsync(() => expect(handleError).toHaveBeenCalledWith(expect.any(TypeError)));
  });

  it("shows the mode the page painted before it rendered", async () => {
    DocsFixture.setMode("Light");
    const host = await renderAsync();

    await DocsFixture.untilAsync(() => expect(checked(host)).toEqual(["Light"]));
  });

  it.each([["Dark", "Dark"], ["Light", "Light"], ["Purple", null]])("has the page shell paint a kept %s before its body", async (stored, painted) => {
    expect(await modeBeforeBodyAsync(stored)).toBe(painted);
  });

  it("puts the page shell's mode script in its head, before any stylesheet", () => {
    const head = new DOMParser().parseFromString(indexPage, "text/html").head;

    expect(head.querySelector("script")?.textContent).toContain(DocsFixture.STORAGE_KEY);
    expect(head.querySelector("link[rel=stylesheet]")).toBeNull();
  });
});
