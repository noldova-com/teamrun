/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@angular/core";
import { MAT_TOOLTIP_DEFAULT_OPTIONS, type MatTooltipDefaultOptions } from "@angular/material/tooltip";

import { Resources } from "../resources";

export class KitProviders {
  public static readonly providers: readonly Provider[] = [
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        showDelay: Resources.tooltipShowDelay,
        hideDelay: Resources.tooltipHideDelay,
        touchendHideDelay: Resources.tooltipTouchendHideDelay,
        position: Resources.tooltipPosition
      } satisfies MatTooltipDefaultOptions
    }
  ];
}
