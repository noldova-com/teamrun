/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWindowsProcessApi {
  listProcesses(): readonly (readonly [number, number])[];
  openProcess(processId: number, access: number): bigint | number;
  readCreationTime(handle: bigint): bigint | null;
  readImagePath(handle: bigint): string | null;
  terminateProcess(handle: bigint): boolean;
  hasExited(handle: bigint): boolean;
  openFileForReading(file: string): bigint | number;
  closeHandle(handle: bigint): void;
}
