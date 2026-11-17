/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

import "@noldova/context.core";

import type { AcpRegistryAgent } from "../../models/acp-registry-agent.js";
import { Resources } from "../../resources.js";

export class AcpRegistryIcons {
  private readonly directory: string;
  private readonly timeout: number;

  public constructor(directory: string, timeout: number) {
    this.directory = directory;
    this.timeout = timeout;
  }

  public async readAsync(agent: AcpRegistryAgent): Promise<string | null> {
    if (Object.isNull(agent.icon))
      return null;
    const file = join(this.directory, `${agent.id}-${agent.version}${Resources.acpIconFileExtension}`);
    if (existsSync(file))
      return readFileSync(file, Resources.utf8Encoding);
    const icon = await this.fetchAsync(agent.icon);
    if (!Object.isNull(icon))
      AcpRegistryIcons.keep(file, icon);
    return icon;
  }

  private async fetchAsync(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, { redirect: Resources.acpRegistryRedirect, signal: AbortSignal.timeout(this.timeout) });
      const type = response.headers.get(Resources.acpIconTypeHeader)?.split(Resources.acpIconTypeSeparator)[0]?.trim().toLowerCase() ?? String.empty;
      if (!response.ok || !Resources.acpIconTypes.includes(type)) {
        await response.body?.cancel();
        return null;
      }
      const body = await AcpRegistryIcons.readLimited(response);
      return Object.isNull(body) ? null : `${Resources.acpIconDataPrefix}${type}${Resources.acpIconDataBase64}${body.toString(Resources.acpIconEncoding)}`;
    }
    catch {
      return null;
    }
  }

  private static async readLimited(response: Response): Promise<Buffer | null> {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for await (const chunk of Readable.fromWeb(response.body as ReadableStream<Uint8Array>) as AsyncIterable<Uint8Array>) {
      received += chunk.byteLength;
      if (received > Resources.acpIconMaxBytes)
        return null;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  private static keep(file: string, icon: string): void {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, icon);
    }
    catch {
      return;
    }
  }
}
