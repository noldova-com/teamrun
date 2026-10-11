/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IWindowsProcessApi, type IWindowsSignature, WindowsProcessApi } from "@noldova/teamrun-shell-runtime";

export class ListedProcessesFixture implements IWindowsProcessApi {
  private readonly api: IWindowsProcessApi;
  private readonly processIds: readonly number[];

  public constructor(processIds: readonly number[], api: IWindowsProcessApi = new WindowsProcessApi()) {
    this.processIds = [...processIds];
    this.api = api;
  }

  public listProcesses(): readonly (readonly [number, number])[] {
    return this.api.listProcesses().filter(([processId]) => this.processIds.includes(processId));
  }

  public openProcess(processId: number, access: number): bigint | number {
    return this.api.openProcess(processId, access);
  }

  public readCreationTime(handle: bigint): bigint | null {
    return this.api.readCreationTime(handle);
  }

  public readImagePath(handle: bigint): string | null {
    return this.api.readImagePath(handle);
  }

  public terminateProcess(handle: bigint): boolean {
    return this.api.terminateProcess(handle);
  }

  public hasExited(handle: bigint): boolean {
    return this.api.hasExited(handle);
  }

  public openFileForReading(file: string): bigint | number {
    return this.api.openFileForReading(file);
  }

  public closeHandle(handle: bigint): void {
    this.api.closeHandle(handle);
  }

  public verifySignatureAsync(file: string): Promise<IWindowsSignature> {
    return this.api.verifySignatureAsync(file);
  }
}
