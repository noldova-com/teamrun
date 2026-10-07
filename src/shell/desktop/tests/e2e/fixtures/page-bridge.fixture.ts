/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

export interface IUpdateState {
  readonly kind: string;
  readonly version: string | null;
  readonly reason: string | null;
}

export interface IPageBridge {
  readUpdate(): Promise<IUpdateState>;
  actOnUpdate(action: string): Promise<boolean>;
}

export default class PageBridgeFixture {
  public static async evaluateAsync<TResult>(page: Page, run: (bridge: IPageBridge) => TResult | Promise<TResult>): Promise<TResult> {
    const bridge = await page.evaluateHandle(() => Reflect.get(globalThis, "teamrun") as IPageBridge);
    try {
      return await bridge.evaluate(run);
    }
    finally {
      await bridge.dispose();
    }
  }
}
