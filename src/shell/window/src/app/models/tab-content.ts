/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector, Type } from "@angular/core";

import type { ContentPadding } from "../enums/content-padding";
import type { ContentPaddingRef } from "./content-padding-ref";

export class TabContent {
  public readonly type: Type<unknown>;
  public readonly injector: Injector;
  public readonly inputs: Readonly<Record<string, unknown>>;
  public readonly padding: ContentPadding;
  public readonly pagePadding: ContentPaddingRef;

  public constructor(type: Type<unknown>, injector: Injector, inputs: Readonly<Record<string, unknown>>, padding: ContentPadding, pagePadding: ContentPaddingRef) {
    this.type = type;
    this.injector = injector;
    this.inputs = inputs;
    this.padding = padding;
    this.pagePadding = pagePadding;
  }
}
