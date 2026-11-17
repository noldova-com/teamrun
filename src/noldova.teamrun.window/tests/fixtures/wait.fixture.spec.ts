/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Wait } from "./wait.fixture";

describe("Wait", () => {
  describe("settled", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("gives the work's value and leaves no timer once the work settles", async () => {
      vi.useFakeTimers();

      expect(await Wait.settled(Promise.resolve(3), "the count")).toBe(3);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects with the work's own error when the work fails first", async () => {
      await expect(Wait.settled(Promise.reject(new Error("The copy failed.")), "the copy's write")).rejects.toThrow("The copy failed.");
    });

    it("rejects naming what it waited for once its bound passes, 10 seconds unless the caller sets another", async () => {
      vi.useFakeTimers();
      const never = new Promise<void>(() => undefined);

      const waited = expect(Wait.settled(never, "the copy's write")).rejects.toThrow("the copy's write did not happen within 10000 ms.");
      await vi.advanceTimersByTimeAsync(10_000);
      await waited;
      const shorter = expect(Wait.settled(never, "the save", { timeout: 50 })).rejects.toThrow("the save did not happen within 50 ms.");
      await vi.advanceTimersByTimeAsync(50);
      await shorter;
    });

    it("names the line that awaited in the stack of its rejection, so two awaits with one text can be told apart", async () => {
      vi.useFakeTimers();
      const never = new Promise<void>(() => undefined);
      const firstAwait = (): Promise<void> => Wait.settled(never, "the copy's write");
      const secondAwait = (): Promise<void> => Wait.settled(never, "the copy's write");

      const stackOf = (work: Promise<void>): Promise<string> => work.then(() => "It didn't reject.", (t: unknown) => t instanceof Error ? t.stack ?? "" : String(t));
      const first = stackOf(firstAwait());
      const second = stackOf(secondAwait());
      await vi.advanceTimersByTimeAsync(10_000);
      const [one, two] = await Promise.all([first, second]);

      expect([one.includes("firstAwait"), one.includes("secondAwait"), two.includes("firstAwait"), two.includes("secondAwait")]).toEqual([true, false, false, true]);
    });
  });
});
