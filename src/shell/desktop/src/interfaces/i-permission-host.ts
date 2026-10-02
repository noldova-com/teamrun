/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPermissionHost {
  setPermissionRequestHandler(handler: (contents: unknown, permission: string, callback: (isGranted: boolean) => void) => void): void;
  setPermissionCheckHandler(handler: () => boolean): void;
}
