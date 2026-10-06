/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LoadOnce } from "../../../src/app/models/load-once";

describe("LoadOnce", () => {
  it("loads once and gives every caller the same load", async () => {
    const once = new LoadOnce<number>();
    const load = vi.fn(() => Promise.resolve(7));

    const values = await Promise.all([once.getAsync(load), once.getAsync(load)]);

    expect([values, load.mock.calls.length]).toEqual([[7, 7], 1]);
  });

  it("forgets a load that failed, so the next caller loads again", async () => {
    const once = new LoadOnce<number>();
    const failure = new Error("The chunk did not load.");

    await expect(once.getAsync(() => Promise.reject(failure))).rejects.toBe(failure);

    await expect(once.getAsync(() => Promise.resolve(8))).resolves.toBe(8);
  });

  it("hands a finished load to what uses it, and ignores one that failed or never started", async () => {
    const used: number[] = [];
    const idle = new LoadOnce<number>();
    const failed = new LoadOnce<number>();
    const loaded = new LoadOnce<number>();
    const failing = failed.getAsync(() => Promise.reject(new Error("Gone.")));

    idle.whenLoaded(t => used.push(t));
    failed.whenLoaded(t => used.push(t));
    await loaded.getAsync(() => Promise.resolve(9));
    loaded.whenLoaded(t => used.push(t));
    await failing.catch(() => undefined);
    await Promise.resolve();

    expect(used).toEqual([9]);
  });
});
