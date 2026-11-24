/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bootstrapApplication } from "@angular/platform-browser";

import { appConfig } from "./app/app.config";
import { DocsShellComponent } from "./app/components/docs-shell/docs-shell.component";

await bootstrapApplication(DocsShellComponent, appConfig);
