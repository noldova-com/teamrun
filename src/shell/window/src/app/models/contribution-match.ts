/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import type { WindowPartContext } from "./window-part-context";

export class ContributionMatch {
  public readonly loadComponent: () => Promise<Type<unknown>>;
  public readonly context: WindowPartContext;

  public constructor(loadComponent: () => Promise<Type<unknown>>, context: WindowPartContext) {
    this.loadComponent = loadComponent;
    this.context = context;
  }
}
