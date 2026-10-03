/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ApplicationRef } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { windowPartSources } from "../../../generated/window-parts";
import { WindowComponent } from "./app/components/window/window.component";
import { WindowPartTokens } from "./app/models/window-part-tokens";
import { Resources } from "./resources";

document.title = Resources.productName;
export const application: ApplicationRef = await bootstrapApplication(WindowComponent, { providers: [{ provide: WindowPartTokens.sources, useValue: windowPartSources }] });
