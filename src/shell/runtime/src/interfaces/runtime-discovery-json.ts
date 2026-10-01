/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IRuntimeDiscoveryJson {
  readonly formatVersion: number;
  readonly endpoint: string;
  readonly token: string;
  readonly processId: number;
  readonly executablePath: string;
  readonly productVersion: string;
  readonly protocolVersion: number;
  readonly build: string;
}
