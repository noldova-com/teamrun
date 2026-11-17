/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ISharedMcpSecrets {
  readAsync(name: string): Promise<string | null>;
  removeAsync(name: string): Promise<void>;
  isSetAsync(name: string): Promise<boolean>;
}
