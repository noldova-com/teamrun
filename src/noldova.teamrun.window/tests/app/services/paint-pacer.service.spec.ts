/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PaintPacerService } from "../../../src/app/services/paint-pacer.service";

describe("PaintPacerService", () => {
  const frame = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  it("runs its work in a task after the next frame, never inside the frame's own callbacks", async () => {
    const order: string[] = [];
    new PaintPacerService().afterPaint(() => order.push("work"));
    requestAnimationFrame(() => queueMicrotask(() => order.push("frame")));

    await frame();
    const atFrame = [...order];
    await new Promise<void>(resolve => new PaintPacerService().afterPaint(resolve));

    expect([atFrame, order]).toEqual([["frame"], ["frame", "work"]]);
  });

  it("never runs its work once stopped, before or after the frame", async () => {
    const pacer = new PaintPacerService();
    let runs = 0;
    pacer.afterPaint(() => runs++)();
    const late = pacer.afterPaint(() => runs++);
    await frame();
    late();
    await new Promise<void>(resolve => pacer.afterPaint(resolve));

    expect(runs).toBe(0);
  });
});
