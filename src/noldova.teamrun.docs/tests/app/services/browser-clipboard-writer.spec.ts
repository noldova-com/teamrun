/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT, type Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { BrowserClipboardWriter } from "../../../src/app/services/browser-clipboard-writer";

describe("BrowserClipboardWriter", () => {
  const writer = (providers: readonly Provider[] = []): BrowserClipboardWriter => {
    TestBed.configureTestingModule({ providers: [BrowserClipboardWriter, ...providers] });
    return TestBed.inject(BrowserClipboardWriter);
  };

  afterEach(() => vi.restoreAllMocks());

  it("writes the text to the clipboard", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    expect(await writer().writeTextAsync("text")).toBe(true);
    expect(write).toHaveBeenCalledWith("text");
  });

  it("answers false when the page has no window to reach a clipboard through", async () => {
    expect(await writer([{ provide: DOCUMENT, useValue: { defaultView: null } }]).writeTextAsync("text")).toBe(false);
  });

  it("answers false when the browser refuses the clipboard", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Refused.", "NotAllowedError"));

    expect(await writer().writeTextAsync("text")).toBe(false);
  });

  it("passes on a failure that is not the browser's refusal", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new TypeError("Broken."));

    await expect(writer().writeTextAsync("text")).rejects.toThrow(TypeError);
  });
});
