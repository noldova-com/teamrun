/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionHost } from "@noldova/teamrun-shell-desktop";

export class FakePermissionHost implements IPermissionHost {
  private requestHandler: ((contents: unknown, permission: string, callback: (isGranted: boolean) => void) => void) | null = null;
  private checkHandler: (() => boolean) | null = null;

  public setPermissionRequestHandler(handler: (contents: unknown, permission: string, callback: (isGranted: boolean) => void) => void): void {
    this.requestHandler = handler;
  }

  public setPermissionCheckHandler(handler: () => boolean): void {
    this.checkHandler = handler;
  }

  public request(permission: string): boolean | null {
    let answer: boolean | null = null;
    this.requestHandler?.(null, permission, t => answer = t);
    return answer;
  }

  public check(): boolean | null {
    return this.checkHandler?.() ?? null;
  }
}
