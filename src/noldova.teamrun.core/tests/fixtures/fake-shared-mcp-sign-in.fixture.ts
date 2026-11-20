/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ISharedMcpSignIn, SharedMcpAccess } from "@noldova/teamrun.core";

export class FakeSharedMcpSignIn implements ISharedMcpSignIn {
  public readonly started: { url: string; reference: string; finished: (access: SharedMcpAccess) => void }[] = [];
  public readonly reads: string[] = [];
  public readonly signedOut: string[] = [];
  public access: SharedMcpAccess = SharedMcpAccess.granted("access-token-5b2e8d", "2026-11-02T11:00:00.000Z");
  public refusal: string | null = null;
  public startRefusal: string | null = null;
  public isHolding: boolean = false;
  private held: PromiseWithResolvers<PromiseWithResolvers<string | null>> = Promise.withResolvers();

  public startAsync(url: string, reference: string, finished: (access: SharedMcpAccess) => void): Promise<string | null> {
    if (!Object.isNull(this.startRefusal))
      return Promise.reject(new Error(this.startRefusal));
    this.started.push({ url, reference, finished });
    if (!this.isHolding)
      return Promise.resolve(`https://auth.example.com/authorize?state=${this.started.length}`);
    const start = Promise.withResolvers<string | null>();
    this.held.resolve(start);
    this.held = Promise.withResolvers();
    return start.promise;
  }

  public nextHeldAsync(): Promise<PromiseWithResolvers<string | null>> {
    return this.held.promise;
  }

  public accessAsync(url: string, reference: string): Promise<SharedMcpAccess> {
    this.reads.push(`${url} ${reference}`);
    return Object.isNull(this.refusal) ? Promise.resolve(this.access) : Promise.reject(new Error(this.refusal));
  }

  public signOutAsync(reference: string): Promise<void> {
    if (!Object.isNull(this.refusal))
      return Promise.reject(new Error(this.refusal));
    this.signedOut.push(reference);
    return Promise.resolve();
  }
}
