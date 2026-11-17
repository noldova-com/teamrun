/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProfileScenarios } from "../profile-scenarios.ts";

const history = { scrollTop: 0, scrollHeight: 400, querySelectorAll: () => ({ length: 3 }) };

const settleAsync = async (isFrameFirst: boolean): Promise<[boolean, readonly number[], readonly number[], readonly number[], readonly number[]]> => {
  const frames: number[] = [];
  const waits: number[] = [];
  const cancelledFrames: number[] = [];
  const clearedWaits: number[] = [];
  const frame = (callback: () => void): number => {
    const id = frames.length + 1;
    frames.push(id);
    if (isFrameFirst)
      queueMicrotask(callback);
    return id;
  };
  const wait = (callback: () => void): number => {
    const id = waits.length + 101;
    waits.push(id);
    if (!isFrameFirst)
      queueMicrotask(callback);
    return id;
  };
  const settled = await ProfileScenarios.settleFramesAsync(history, [2, 10, 60_000], frame, t => cancelledFrames.push(t), wait, t => clearedWaits.push(t));
  return [settled, frames, waits, cancelledFrames, clearedWaits];
};

describe("ProfileScenarios", () => {
  it("clears each step's timeout when its frame comes first, and settles once the history stays the same", async () => {
    const [settled, frames, waits, cancelledFrames, clearedWaits] = await settleAsync(true);

    assert.deepEqual([settled, frames, cancelledFrames, clearedWaits], [true, [1, 2, 3], [], waits]);
  });

  it("cancels each step's frame when its timeout comes first, and settles once the history stays the same", async () => {
    const [settled, frames, waits, cancelledFrames, clearedWaits] = await settleAsync(false);

    assert.deepEqual([settled, waits, cancelledFrames, clearedWaits], [true, [101, 102, 103], frames, []]);
  });
});
