/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomBytes } from "node:crypto";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class SessionTokens {
  private readonly now: () => number;
  private readonly entries: Map<string, { sessions: readonly string[]; owner: string | null; issuedAt: number; kept: boolean }> = new Map();
  private readonly sessions: Map<string, string> = new Map();

  public constructor(now: () => number = Date.now) {
    this.now = now;
  }

  public open(session: string, owner: string): void {
    this.sessions.set(session, owner);
  }

  public close(session: string): void {
    this.sessions.delete(session);
    for (const [hash, entry] of this.entries) {
      const sessions = entry.sessions.filter(t => t !== session);
      if (!entry.kept && sessions.length === 0)
        this.entries.delete(hash);
      else
        this.entries.set(hash, { ...entry, sessions });
    }
  }

  public issue(session: string): string {
    return this.add(session, false);
  }

  public issueKept(session: string): string {
    return this.add(session, true);
  }

  public adopt(token: string, session: string): boolean {
    const hash = SessionTokens.hashOf(token);
    const entry = this.entries.get(hash);
    const owner = this.sessions.get(session);
    if (Object.isUndefined(entry) || !entry.kept || this.isExpired(entry) || entry.owner !== owner)
      return false;
    this.entries.set(hash, { ...entry, sessions: [...entry.sessions.filter(t => t !== session), session] });
    return true;
  }

  public find(token: string): string | null {
    const hash = SessionTokens.hashOf(token);
    const entry = this.entries.get(hash);
    if (Object.isUndefined(entry))
      return null;
    const session = this.isExpired(entry) ? undefined : entry.sessions.findLast(t => this.sessions.has(t));
    if (!Object.isUndefined(session))
      return session;
    if (this.isLapsed(entry))
      this.entries.delete(hash);
    return null;
  }

  public ownerOf(token: string): string | null {
    const entry = this.entries.get(SessionTokens.hashOf(token));
    return Object.isUndefined(entry) || this.isLapsed(entry) ? null : entry.owner;
  }

  public revoke(token: string): void {
    this.entries.delete(SessionTokens.hashOf(token));
  }

  private add(session: string, kept: boolean): string {
    for (const [hash, entry] of this.entries) {
      if (this.isLapsed(entry))
        this.entries.delete(hash);
    }
    const token = randomBytes(Resources.mcpTokenBytes).toString("base64url");
    this.entries.set(SessionTokens.hashOf(token), { sessions: [session], owner: this.sessions.get(session) ?? null, issuedAt: this.now(), kept });
    return token;
  }

  private isLapsed(entry: { sessions: readonly string[]; issuedAt: number; kept: boolean }): boolean {
    return this.isExpired(entry) || !entry.kept && !entry.sessions.some(t => this.sessions.has(t));
  }

  private isExpired(entry: { issuedAt: number }): boolean {
    return this.now() - entry.issuedAt >= Resources.sessionTokenLifetime;
  }

  private static hashOf(token: string): string {
    return createHash("sha256").update(token).digest("base64url");
  }
}
