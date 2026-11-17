/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowApplication } from "@noldova/desktop.window/build";
import { provideCodeHighlightingWorker } from "@noldova/ui.components.angular/code-highlighting";

import { gallery } from "../../../_build/generated/gallery";
import { productName } from "../../../_build/generated/product";
import { moduleMenus, windowPartSources } from "../../../_build/generated/window-parts";

await WindowApplication.startAsync({ productName, windowParts: windowPartSources, menus: moduleMenus, gallery,
  providers: [provideCodeHighlightingWorker(() => new Worker(new URL("./code-highlighting.worker", import.meta.url), { type: "module" }))] });
