/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPoint {
  readonly x: number;
  readonly y: number;
}

export interface IRectangle extends IPoint {
  readonly width: number;
  readonly height: number;
}

export default class OffCursorPlacement {
  public static contains(bounds: IRectangle, cursor: IPoint): boolean {
    return cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
  }

  public static candidates(bounds: IRectangle, cursor: IPoint): readonly IRectangle[] {
    const shifts: readonly IPoint[] = [
      { x: cursor.x + 1 - bounds.x, y: 0 },
      { x: cursor.x - bounds.x - bounds.width, y: 0 },
      { x: 0, y: cursor.y + 1 - bounds.y },
      { x: 0, y: cursor.y - bounds.y - bounds.height }
    ];
    return shifts
      .toSorted((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y))
      .map(t => ({ ...bounds, x: bounds.x + t.x, y: bounds.y + t.y }));
  }

  public static async placeAsync(bounds: IRectangle, cursor: IPoint, displays: readonly IRectangle[], moveAsync: (target: IRectangle) => Promise<IRectangle>): Promise<IRectangle> {
    if (!OffCursorPlacement.contains(bounds, cursor))
      return bounds;
    const attempts: string[] = [];
    for (const target of OffCursorPlacement.candidates(bounds, cursor)) {
      const actual = await moveAsync(target);
      if (!OffCursorPlacement.contains(actual, cursor))
        return actual;
      attempts.push(`${OffCursorPlacement.describe(target)} became ${OffCursorPlacement.describe(actual)}`);
    }
    await moveAsync(bounds);
    throw new Error(
      `The window ${OffCursorPlacement.describe(bounds)} cannot be moved off the cursor at ${cursor.x},${cursor.y}. ` +
      `Each move left the cursor inside: ${attempts.join("; ")}. Displays: ${displays.map(t => OffCursorPlacement.describe(t)).join("; ")}.`);
  }

  public static describe(bounds: IRectangle): string {
    return `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`;
  }
}
