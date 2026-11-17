/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";

import { SignInException } from "../../exceptions/sign-in.exception.js";
import type { IExitHandler } from "../../interfaces/i-exit-handler.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import { Resources } from "../../resources.js";
import type { AppServerClient } from "./app-server-client.js";

export class CodexLogin implements INotificationHandler, IExitHandler {
  private readonly client: AppServerClient;
  private readonly requestTimeout: number;
  private readonly completions: Map<string, string | null> = new Map();
  private readonly done: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private loginId: string | null = null;
  private cancelled: boolean = false;
  private ended: boolean = false;
  private cancelling: Promise<void> = Promise.resolve();

  public constructor(client: AppServerClient, requestTimeout: number) {
    this.client = client;
    this.requestTimeout = requestTimeout;
    void this.done.promise.catch(() => undefined);
  }

  public wait(): Promise<void> {
    return this.done.promise;
  }

  public begin(loginId: string): void {
    this.loginId = loginId;
    if (this.cancelled)
      void this.sendCancel(loginId);
    const completion = this.completions.get(loginId);
    if (!Object.isUndefined(completion))
      this.finish(completion);
  }

  public cancel(): Promise<void> {
    if (this.cancelled || this.ended)
      return this.cancelling;
    this.cancelled = true;
    if (!Object.isNull(this.loginId))
      this.cancelling = this.sendCancel(this.loginId);
    this.done.reject(new SignInException(Resources.codexSignInCancelled));
    return this.cancelling;
  }

  public handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    if (method !== Resources.loginCompletedMethod)
      return Promise.resolve();
    let loginId: string | null;
    let error: string | null;
    try {
      loginId = params.readNullableString(Resources.loginIdField);
      if (Object.isNull(loginId))
        return Promise.resolve();
      error = params.readBoolean(Resources.successField) ? null : params.readNullableString(Resources.errorField) ?? Resources.codexSignInNotCompleted;
    }
    catch {
      this.done.reject(new SignInException(Resources.codexSignInUnreadable));
      return Promise.resolve();
    }
    if (loginId === this.loginId)
      this.finish(error);
    else
      this.completions.set(loginId, error);
    return Promise.resolve();
  }

  public handleExitAsync(): Promise<void> {
    this.ended = true;
    this.done.reject(new SignInException(Resources.appServerExitedDuringSignIn));
    return Promise.resolve();
  }

  private finish(error: string | null): void {
    this.ended = true;
    if (Object.isNull(error))
      this.done.resolve();
    else
      this.done.reject(new SignInException(Resources.formatCodexSignInFailed(error)));
  }

  private sendCancel(loginId: string): Promise<void> {
    return this.client.request(Resources.loginCancelMethod, { [Resources.loginIdField]: loginId }, this.requestTimeout).then(() => undefined, () => undefined);
  }
}
