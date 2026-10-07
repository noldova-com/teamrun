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
  request(method: string, payload: unknown): Promise<unknown>;
  readBuild(): Promise<unknown>;
  readLayout(): Promise<unknown>;
  writeLayout(layout: unknown): Promise<unknown>;
  onStartup(listener: (state: unknown) => void): () => void;
  readTrayAvailable(): Promise<unknown>;
  readUpdate(): Promise<IUpdateState>;
  actOnUpdate(action: string): Promise<boolean>;
}

export default class PageBridgeFixture {
  public static evaluateAsync<TResult>(page: Page, run: (bridge: IPageBridge) => TResult | Promise<TResult>): Promise<TResult>;
  public static evaluateAsync<TResult, TArgument>(page: Page, run: (bridge: IPageBridge, argument: TArgument) => TResult | Promise<TResult>, argument: TArgument): Promise<TResult>;
  public static async evaluateAsync<TResult>(page: Page, run: (bridge: IPageBridge, argument: unknown) => TResult | Promise<TResult>, argument?: unknown): Promise<TResult> {
    const bridge = await page.evaluateHandle(() => Reflect.get(globalThis, "teamrun") as IPageBridge);
    try {
      return await bridge.evaluate(run, argument);
    }
    finally {
      await bridge.dispose();
    }
  }
}
