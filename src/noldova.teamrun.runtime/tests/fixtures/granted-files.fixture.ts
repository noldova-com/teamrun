/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FileHandle, open } from "node:fs/promises";
import { basename } from "node:path";

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { GrantedFile, type IRuntimeFiles, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";

export class GrantedFiles implements IRuntimeFiles {
  public readonly redeemed: [string, RequestContext][] = [];
  public readonly opened: FileHandle[] = [];
  private readonly paths: Map<string, string> = new Map();

  public grant(grant: string, path: string): void {
    this.paths.set(grant, path);
  }

  public async redeemAsync(grant: string, request: RequestContext): Promise<GrantedFile> {
    this.redeemed.push([grant, request]);
    const path = this.paths.get(grant);
    this.paths.delete(grant);
    if (Object.isUndefined(path))
      throw new MethodFailureException(new Failure(FailureCode.NotFound, "The grant is unknown."));
    const handle = await open(path, "r");
    this.opened.push(handle);
    return new GrantedFile(basename(path), "application/octet-stream", (await handle.stat()).size, handle);
  }

  public shareAsync(): Promise<string> {
    return Promise.reject(new Error("The test shares no files."));
  }
}
