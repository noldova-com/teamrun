/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isPlatformBrowser } from "@angular/common";
import { DOCUMENT, Injectable, PLATFORM_ID, inject } from "@angular/core";

import "@noldova/context.core";

import { VisitCounterResources } from "./visit-counter-resources";

@Injectable({ providedIn: "root" })
export class VisitCounter {
  private readonly document: Document = inject(DOCUMENT);
  private readonly isBrowser: boolean = isPlatformBrowser(inject(PLATFORM_ID));

  public start(): void {
    if (!this.isBrowser || this.document.location.hostname !== VisitCounterResources.productionHost
      || !Object.isNullOrUndefined(this.document.head.querySelector(VisitCounterResources.beaconSelector)))
      return;
    const script = this.document.createElement(VisitCounterResources.scriptTag);
    script.defer = true;
    script.src = VisitCounterResources.beaconSource;
    script.setAttribute(VisitCounterResources.beaconAttribute, JSON.stringify({ token: VisitCounterResources.beaconToken }));
    this.document.head.append(script);
  }
}
