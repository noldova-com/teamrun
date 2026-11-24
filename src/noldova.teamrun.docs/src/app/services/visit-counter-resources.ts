/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VisitCounterResources {
  public static readonly productionHost: string = "teamrun.noldova.dev";
  public static readonly beaconSource: string = "https://static.cloudflareinsights.com/beacon.min.js";
  public static readonly beaconToken: string = "4b8047431bbc42e5961be329dfb3181c";
  public static readonly beaconAttribute: string = "data-cf-beacon";
  public static readonly scriptTag: "script" = "script";
  public static readonly beaconSelector: string = `script[src="${VisitCounterResources.beaconSource}"]`;
}
