/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FileShare } from "./file-share";

export class KeptRead {
  private share: FileShare | null = null;
  private expiresAt: number = Number.POSITIVE_INFINITY;
  private released: boolean = false;
  private drawing: number = 0;

  public readonly conversationId: string;
  public readonly url: Promise<string | null>;
  public bytes: number | null = null;
  public isShare: boolean = false;

  public constructor(conversationId: string, url: Promise<string | null>) {
    this.conversationId = conversationId;
    this.url = url;
  }

  public keep(share: FileShare, expiresAt: number): string {
    this.isShare = true;
    this.share = share;
    this.expiresAt = expiresAt;
    this.drop();
    return share.address;
  }

  public async drawAsync<T>(draw: (url: string | null) => Promise<T>): Promise<T> {
    this.drawing++;
    try {
      return await draw(await this.url);
    }
    finally {
      this.drawing--;
      this.drop();
    }
  }

  public hasExpired(now: number): boolean {
    return this.released || now >= this.expiresAt;
  }

  public release(): void {
    this.released = true;
    this.drop();
  }

  private drop(): void {
    if (!this.released || this.drawing > 0)
      return;
    this.share?.release();
    this.share = null;
  }
}
