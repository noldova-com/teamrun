/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ApplicationRef } from "@angular/core";
import { type BootstrapContext, bootstrapApplication } from "@angular/platform-browser";

import { serverConfig } from "./app/app.config.server";
import { DocsShellComponent } from "./app/components/docs-shell/docs-shell.component";

export default function bootstrap(context: BootstrapContext): Promise<ApplicationRef> {
  return bootstrapApplication(DocsShellComponent, serverConfig, context);
}
