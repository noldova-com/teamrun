/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";

import { PagesClock } from "../../../../src/app/services/pages/pages-clock";
import { SampleData } from "../../../fixtures/sample-data.fixture";

describe("PagesClock", () => {
  const start = Date.parse(SampleData.timestamp);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(start);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks its signal with the time once a minute, and stops when its injector is destroyed", async () => {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const now = runInInjectionContext(injector, () => PagesClock.ticking());

    await vi.advanceTimersByTimeAsync(59_999);
    const early = now();
    await vi.advanceTimersByTimeAsync(1);
    const minute = now();
    injector.destroy();
    await vi.advanceTimersByTimeAsync(60_000);

    expect([early, minute, now()]).toEqual([start, start + 60_000, start + 60_000]);
  });
});
