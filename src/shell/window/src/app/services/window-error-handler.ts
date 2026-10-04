/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { WindowPartFailureException } from "../exceptions/window-part-failure.exception";
import { Resources } from "../../resources";
import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable()
export class WindowErrorHandler extends ErrorHandler {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private recent: readonly number[] = [];

  public override handleError(error: unknown): void {
    super.handleError(error);
    const now = Date.now();
    this.recent = this.recent.filter(t => now - t < Resources.windowErrorPeriod);
    if (this.recent.length > Resources.windowErrorBurst)
      return;
    this.recent = [...this.recent, now];
    if (this.recent.length > Resources.windowErrorBurst)
      this.bridge.logError(null, Resources.windowErrorsHeldBack);
    else
      this.bridge.logError(error instanceof WindowPartFailureException ? error.moduleId : null, WindowErrorHandler.describe(error));
  }

  private static describe(error: unknown): string {
    if (!(error instanceof Error))
      return String(error);
    const text = error.stack ?? `${error.name}: ${error.message}`;
    return Object.isUndefined(error.cause) ? text : `${text}${Resources.causeSeparator}${WindowErrorHandler.describe(error.cause)}`;
  }
}
