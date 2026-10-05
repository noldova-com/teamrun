/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import { ContentPadding } from "../enums/content-padding";
import type { WindowPartContext } from "./window-part-context";

export class ContributionMatch {
  public readonly loadComponent: () => Promise<Type<unknown>>;
  public readonly context: WindowPartContext | null;
  public readonly padding: ContentPadding;

  public constructor(loadComponent: () => Promise<Type<unknown>>, context: WindowPartContext | null, padding: ContentPadding | null = null) {
    this.loadComponent = loadComponent;
    this.context = context;
    this.padding = padding ?? ContentPadding.Default;
  }
}
