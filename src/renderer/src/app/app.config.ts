/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from "@angular/core";
import { MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS } from "@angular/material/button-toggle";
import { MatIconRegistry } from "@angular/material/icon";
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { Resources } from "./resources";
import { TEAMRUN_BRIDGE } from "./services/bridge.service";
import { WindowBridgeFactory } from "./services/window-bridge-factory";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: TEAMRUN_BRIDGE, useFactory: WindowBridgeFactory.create },
    { provide: MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS, useValue: { hideSingleSelectionIndicator: true } },
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: Resources.tooltipDefaultOptions },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass(Resources.iconFontClass);
    })
  ]
};
