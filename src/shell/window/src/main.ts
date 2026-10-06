/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ApplicationRef, ErrorHandler, provideBrowserGlobalErrorListeners } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { ClipboardWriter } from "@noldova/teamrun-shell-ui";

import { gallery } from "../../../generated/gallery";
import { moduleMenus, windowPartSources } from "../../../generated/window-parts";
import { WindowComponent } from "./app/components/window/window.component";
import { BuildTokens } from "./app/models/build-tokens";
import { GalleryTokens } from "./app/models/gallery-tokens";
import { DesktopBridgeService } from "./app/services/desktop-bridge.service";
import { WindowErrorHandler } from "./app/services/window-error-handler";
import { Resources } from "./resources";

document.title = Resources.productName;
export const application: ApplicationRef = await bootstrapApplication(WindowComponent, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: WindowErrorHandler },
    { provide: BuildTokens.sources, useValue: windowPartSources },
    { provide: BuildTokens.menus, useValue: moduleMenus },
    { provide: GalleryTokens.component, useValue: gallery },
    { provide: ClipboardWriter, useExisting: DesktopBridgeService }
  ]
});
