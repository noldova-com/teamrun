/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "@playwright/test";

import OffCursorPlacement, { type Point, type Rectangle } from "./fixtures/off-cursor-placement.ts";

test.describe("the harness's move of the window off the real cursor", () => {
  const main: Rectangle = { x: 0, y: 0, width: 1920, height: 1080 };
  const left: Rectangle = { x: -1440, y: 0, width: 1440, height: 900 };
  const window: Rectangle = { x: 320, y: 84, width: 1280, height: 800 };
  const menuBar = 25;

  function belowMenuBar(target: Rectangle): Rectangle {
    return { ...target, y: Math.max(target.y, menuBar) };
  }

  function recorder(clamp: (target: Rectangle) => Rectangle): { readonly targets: Rectangle[]; readonly moveAsync: (target: Rectangle) => Promise<Rectangle> } {
    const targets: Rectangle[] = [];
    return { targets, moveAsync: async target => { targets.push(target); return clamp(target); } };
  }

  async function placeAsync(bounds: Rectangle, cursor: Point, clamp: (target: Rectangle) => Rectangle = t => t): Promise<{ readonly placed: Rectangle; readonly targets: readonly Rectangle[] }> {
    const moves = recorder(clamp);
    const placed = await OffCursorPlacement.placeAsync(bounds, cursor, [main, left], moves.moveAsync);
    return { placed, targets: moves.targets };
  }

  test("a window that does not contain the cursor stays where it is", async () => {
    const result = await placeAsync(window, { x: 100, y: 500 });

    expect(result).toEqual({ placed: window, targets: [] });
  });

  test("the cursor in the middle moves the window by the shortest shift past an edge, nearest first", async () => {
    const cursor = { x: 900, y: 572 };

    const result = await placeAsync(window, cursor);

    expect(OffCursorPlacement.candidates(window, cursor).map(t => [t.x, t.y])).toEqual([[320, -228], [320, 573], [901, 84], [-380, 84]]);
    expect(result.targets).toEqual([{ ...window, y: -228 }]);
    expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
  });

  test("a window that macOS holds below the menu bar is moved by the next shift, and the shifts that failed are not kept", async () => {
    const cursor = { x: 900, y: 572 };

    const result = await placeAsync(window, cursor, belowMenuBar);

    expect(result.targets).toEqual([{ ...window, y: -228 }, { ...window, y: 573 }]);
    expect(result.placed).toEqual({ ...window, y: 573 });
  });

  for (const [name, cursor, shift] of [
    ["left", { x: 320, y: 400 }, { x: 1, y: 0 }],
    ["right", { x: 1599, y: 400 }, { x: -1, y: 0 }],
    ["top", { x: 900, y: 84 }, { x: 0, y: 1 }],
    ["bottom", { x: 900, y: 883 }, { x: 0, y: -1 }]
  ] as const)
    test(`a cursor on the window's ${name} edge moves the window by one pixel`, async () => {
      const result = await placeAsync(window, cursor, belowMenuBar);

      expect(result.targets).toEqual([{ ...window, x: window.x + shift.x, y: window.y + shift.y }]);
      expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
    });

  test("shifts of the same length keep the order right, left, down, up", () => {
    const square: Rectangle = { x: 0, y: 100, width: 100, height: 100 };

    expect(OffCursorPlacement.candidates(square, { x: 50, y: 150 }).map(t => [t.x, t.y])).toEqual([[-50, 100], [0, 50], [51, 100], [0, 151]]);
  });

  test("a cursor on a display left of the main one, at negative coordinates, with the window across both, is cleared by the nearest shift", async () => {
    const across: Rectangle = { x: -1000, y: 100, width: 1280, height: 800 };
    const cursor = { x: -700, y: 400 };

    const result = await placeAsync(across, cursor, belowMenuBar);

    expect(OffCursorPlacement.contains(across, cursor)).toBe(true);
    expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
    expect(result.targets).toEqual([{ ...across, x: -699 }]);
  });

  test("when no shift clears the cursor, the window goes back and the failure names the cursor, the window, each attempt and the displays", async () => {
    const cursor = { x: 900, y: 572 };
    const moves = recorder(() => window);

    const failure = await OffCursorPlacement.placeAsync(window, cursor, [main, left], moves.moveAsync).then(() => null, (error: unknown) => error);

    expect(moves.targets.at(-1)).toEqual(window);
    expect(moves.targets).toHaveLength(5);
    expect((failure as Error).message).toBe(
      "The window 320,84 1280x800 cannot be moved off the cursor at 900,572. Each move left the cursor inside: " +
      "320,-228 1280x800 became 320,84 1280x800; 320,573 1280x800 became 320,84 1280x800; " +
      "901,84 1280x800 became 320,84 1280x800; -380,84 1280x800 became 320,84 1280x800. " +
      "Displays: 0,0 1920x1080; -1440,0 1440x900.");
  });
});
