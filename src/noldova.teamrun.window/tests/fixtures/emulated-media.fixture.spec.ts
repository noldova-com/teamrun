/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cdp } from "vitest/browser";

import { EmulatedMediaFixture } from "./emulated-media.fixture";

describe("EmulatedMediaFixture", () => {
  afterEach(() => EmulatedMediaFixture.resetAsync());

  it("emulates each change of the media and sends nothing when the media asked for is already emulated", async () => {
    await EmulatedMediaFixture.resetAsync();
    const send = vi.spyOn(cdp(), "send");
    try {
      await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
      await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
      const forced = matchMedia("(forced-colors: active)").matches;
      await EmulatedMediaFixture.emulateAsync("forced-colors", "none");
      await EmulatedMediaFixture.resetAsync();
      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");

      expect([forced, matchMedia("(forced-colors: active)").matches, matchMedia("(prefers-reduced-motion: reduce)").matches, send.mock.calls.length])
        .toEqual([true, false, true, 3]);
    }
    finally {
      send.mockRestore();
    }
  });

  it("emulates several media at once, and a reset ends each of them", async () => {
    await EmulatedMediaFixture.emulateEachAsync({ "forced-colors": "active", "prefers-color-scheme": "dark" });
    const during = [matchMedia("(forced-colors: active)").matches, matchMedia("(prefers-color-scheme: dark)").matches];
    await EmulatedMediaFixture.resetAsync();

    expect([during, [matchMedia("(forced-colors: active)").matches, matchMedia("(prefers-color-scheme: dark)").matches]]).toEqual([[true, true], [false, false]]);
  });

  it("sends the media asked for after a send that failed, even when Chromium applied the failed one", async () => {
    await EmulatedMediaFixture.resetAsync();
    const original = cdp().send.bind(cdp());
    const send = vi.spyOn(cdp(), "send").mockImplementationOnce(async (method, parameters) => {
      await original(method, parameters);
      throw new Error("The answer was lost.");
    });
    try {
      await expect(EmulatedMediaFixture.emulateAsync("forced-colors", "active")).rejects.toThrow("The answer was lost.");
      const applied = matchMedia("(forced-colors: active)").matches;
      await EmulatedMediaFixture.resetAsync();

      expect([applied, send.mock.calls.length, matchMedia("(forced-colors: active)").matches]).toEqual([true, 2, false]);
    }
    finally {
      send.mockRestore();
    }
  });
});
