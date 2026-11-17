/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rm, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { AcpRegistryException } from "../../exceptions/acp-registry.exception.js";
import { AcpRegistry } from "../../models/acp-registry.js";
import { AcpRegistryListing } from "../../models/acp-registry-listing.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { DownloadAddress } from "../installs/download-address.js";

export class AcpRegistrySource {
  private readonly url: string;
  private readonly cacheFile: string;
  private readonly maxAge: number;
  private readonly timeout: number;
  private readonly now: () => number;
  private reading: Promise<AcpRegistryListing> | null = null;

  public constructor(url: string, cacheFile: string, maxAge: number, timeout: number, now: () => number = Date.now) {
    if (!DownloadAddress.isSafe(url))
      throw new ArgumentException(Resources.acpRegistryUrlRefused, Resources.acpRegistryUrlParameter);
    this.url = url;
    this.cacheFile = cacheFile;
    this.maxAge = maxAge;
    this.timeout = timeout;
    this.now = now;
  }

  public readAsync(): Promise<AcpRegistryListing> {
    this.reading ??= this.readFreshAsync().finally(() => {
      this.reading = null;
    });
    return this.reading;
  }

  private async readFreshAsync(): Promise<AcpRegistryListing> {
    const cached = this.readCache();
    if (!Object.isNull(cached) && this.isFresh(cached))
      return cached;
    try {
      const text = await this.fetchAsync();
      const registry = AcpRegistry.read(text);
      await this.writeCacheAsync(text);
      return new AcpRegistryListing(registry, new Date(this.now()));
    }
    catch (error) {
      if (Object.isNull(cached))
        throw error;
      return new AcpRegistryListing(cached.registry, cached.fetchedAt, FailureDescriber.describe(error));
    }
  }

  private isFresh(listing: AcpRegistryListing): boolean {
    const age = this.now() - listing.fetchedAt.getTime();
    return age >= 0 && age < this.maxAge;
  }

  private async fetchAsync(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.url, { headers: { [Resources.acceptHeader]: Resources.jsonContentType }, redirect: Resources.acpRegistryRedirect,
        signal: AbortSignal.timeout(this.timeout) });
    }
    catch (error) {
      throw new AcpRegistryException(Resources.acpRegistryUnreachable, error);
    }
    if (!response.ok)
      throw new AcpRegistryException(Resources.formatAcpRegistryFailed(response.status));
    return AcpRegistrySource.readLimitedAsync(response);
  }

  private static async readLimitedAsync(response: Response): Promise<string> {
    const body = response.body;
    if (Object.isNull(body))
      return String.empty;
    const reader = body.getReader();
    const refuseAsync = async (): Promise<never> => {
      await reader.cancel();
      throw new AcpRegistryException(Resources.acpRegistryUnreadable);
    };
    if (Number(response.headers.get(Resources.acpRegistryLengthHeader)) > Resources.acpRegistryMaxBytes)
      return refuseAsync();
    const nextAsync = async (): ReturnType<typeof reader.read> => {
      try {
        return await reader.read();
      }
      catch (error) {
        throw new AcpRegistryException(Resources.acpRegistryUnreachable, error);
      }
    };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (let read = await nextAsync(); !read.done; read = await nextAsync()) {
      size += read.value.byteLength;
      if (size > Resources.acpRegistryMaxBytes)
        return refuseAsync();
      chunks.push(read.value);
    }
    return Buffer.concat(chunks).toString(Resources.utf8Encoding);
  }

  private readCache(): AcpRegistryListing | null {
    if (!existsSync(this.cacheFile))
      return null;
    try {
      return new AcpRegistryListing(AcpRegistry.read(readFileSync(this.cacheFile, Resources.utf8Encoding)), statSync(this.cacheFile).mtime);
    }
    catch {
      return null;
    }
  }

  private async writeCacheAsync(text: string): Promise<void> {
    const temporary = `${this.cacheFile}.${randomUUID()}`;
    try {
      mkdirSync(dirname(this.cacheFile), { recursive: true });
    }
    catch {
      return;
    }
    try {
      writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
      renameSync(temporary, this.cacheFile);
    }
    catch {
      await new Promise<void>(resolve => {
        rm(temporary, { force: true }, () => resolve());
      });
    }
  }
}
