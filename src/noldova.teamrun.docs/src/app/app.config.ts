/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LocationStrategy, TrailingSlashPathLocationStrategy } from "@angular/common";
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideClientHydration } from "@angular/platform-browser";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import { routes } from "./app.routes";
import { BrowserClipboardWriter } from "./services/browser-clipboard-writer";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideRouter(routes, withComponentInputBinding()),
    provideMarkdown(),
    provideCodeHighlighting(),
    { provide: LocationStrategy, useClass: TrailingSlashPathLocationStrategy },
    { provide: ClipboardWriter, useClass: BrowserClipboardWriter }
  ]
};
