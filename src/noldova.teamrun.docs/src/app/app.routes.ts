/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Routes } from "@angular/router";

import { Resources } from "../resources";
import { DocsPageComponent } from "./components/docs-page/docs-page.component";
import { DocsCatalog } from "./models/docs-catalog";

export const routes: Routes = DocsCatalog.pages.map(t => ({ path: t.path, component: DocsPageComponent, title: Resources.formatPageTitle(t.title), data: { page: t } }));
