/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

interface IBridge {
  request(method: string, payload: unknown): Promise<{ payload?: unknown }>;
}

export default class NotesOptionsFixture {
  public static readonly HOLD_FIRST_MARKER: string = "modules/notes/hold-first-options";

  public static async holdAsync(window: Page): Promise<void> {
    await NotesOptionsFixture.requestAsync(window, "notes.holdOptions");
  }

  public static heldAsync(window: Page): Promise<unknown> {
    return NotesOptionsFixture.requestAsync(window, "notes.heldOptions");
  }

  public static async releaseAsync(window: Page): Promise<void> {
    await NotesOptionsFixture.requestAsync(window, "notes.releaseOptions");
  }

  private static requestAsync(window: Page, method: string): Promise<unknown> {
    return window.evaluate(async name => (await (Reflect.get(globalThis, "teamrun") as IBridge).request(name, null)).payload, method);
  }
}
