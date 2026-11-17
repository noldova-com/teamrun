/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IPowershellSession } from "@noldova/teamrun.providers";

export class ListingPowershellSession implements IPowershellSession {
  private readonly listings: readonly (string | null)[];

  public readonly calls: [string, number][] = [];

  public constructor(listings: readonly (string | null)[]) {
    this.listings = listings;
  }

  public run(script: string, timeout: number): Promise<string> {
    const listing = this.listings[Math.min(this.calls.length, this.listings.length - 1)]!;
    this.calls.push([script, timeout]);
    return Object.isNull(listing) ? Promise.reject(new Error("The listing failed.")) : Promise.resolve(listing);
  }
}
