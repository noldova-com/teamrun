/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { open, rm } from "node:fs/promises";
import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import "@noldova/context.core";

import { ReleaseSourceException } from "../../exceptions/release-source.exception.js";
import type { ReleaseFile } from "../../models/release-file.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { DownloadAddress } from "./download-address.js";

export class ReleaseDownload {
  public static async save(file: ReleaseFile, path: string, name: string, progress: (received: number, total: number) => void, signal: AbortSignal,
    limit: number = Resources.releaseDownloadLimit): Promise<void> {
    const output = (await open(path, "wx")).createWriteStream();
    try {
      const response = await ReleaseDownload.reachable(name, signal, () => fetch(file.url, { headers: { [Resources.acceptEncodingHeader]: Resources.identityEncoding }, signal }));
      if (!response.ok || Object.isNull(response.body))
        throw new ReleaseSourceException(Resources.formatDownloadFailed(name, response.status));
      if (Object.isNull(file.sha256) && !DownloadAddress.isSafe(response.url)) {
        await response.body.cancel();
        throw new ReleaseSourceException(Resources.formatDownloadInsecure(name));
      }
      const length = Number.parseInt(response.headers.get(Resources.contentLengthName) ?? String.empty, 10);
      const total = file.bytes ?? (Number.isSafeInteger(length) && length > 0 ? length : 0);
      const hash = createHash(Resources.sha256Algorithm);
      let received = 0;
      await ReleaseDownload.reachable(name, signal, () => pipeline(Readable.fromWeb(response.body as ReadableStream<Uint8Array>), async function* (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          received += chunk.byteLength;
          if (!Object.isNull(file.bytes) && received > file.bytes)
            throw new ReleaseSourceException(Resources.formatDownloadMismatch(name));
          if (Object.isNull(file.bytes) && received > limit)
            throw new ReleaseSourceException(Resources.formatDownloadTooLarge(name, limit));
          hash.update(chunk);
          progress(received, Math.max(total, received));
          yield chunk;
        }
      }, output));
      if ((!Object.isNull(file.bytes) && received !== file.bytes) || (!Object.isNull(file.sha256) && hash.digest(Resources.hexEncoding) !== file.sha256))
        throw new ReleaseSourceException(Resources.formatDownloadMismatch(name));
      await ReleaseDownload.close(output);
    }
    catch (error) {
      try {
        await ReleaseDownload.close(output);
        await rm(path, { force: true, maxRetries: Resources.removeRetries });
      }
      catch (failure) {
        throw new ReleaseSourceException(FailureDescriber.describe(error), new SuppressedError(failure, error, FailureDescriber.describe(error)));
      }
      throw error;
    }
  }

  public static async reachable<T>(name: string, signal: AbortSignal, request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    }
    catch (error) {
      if (error instanceof TypeError && !Object.isUndefined(error.cause) && !signal.aborted)
        throw new ReleaseSourceException(Resources.formatReleasesUnreachable(name), error);
      throw error;
    }
  }

  public static close(output: Writable): Promise<void> {
    if (output.closed)
      return Promise.resolve();
    const errored = output.errored;
    return new Promise((resolve, reject) => output.once("error", error => {
      if (error !== errored)
        reject(error);
    }).once("close", () => resolve()).destroy());
  }
}
