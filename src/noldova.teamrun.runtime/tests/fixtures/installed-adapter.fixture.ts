/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ForkRequest, IProviderAdapter, IProviderKindInstallation, ISignInListener, ITurnListener, SignInCheck, TurnRequest, TurnResult } from "@noldova/teamrun.core";
import { type ForkedSession, type Provider, ProviderKind, type ProviderMode, ProviderModelList } from "@noldova/teamrun.protocol";

export class InstalledAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderKind = new ProviderKind("installed", "Installed provider", true, false);
  public readonly modes: readonly ProviderMode[] = [];
  public readonly defaultMode: string | null = null;
  public readonly installation: IProviderKindInstallation;

  public constructor(installation: IProviderKindInstallation) {
    this.installation = installation;
  }

  public checkSignIn(_provider: Provider): Promise<SignInCheck> {
    return Promise.reject(new Error("The fixture checks no sign-in."));
  }

  public signIn(_provider: Provider, _signal: AbortSignal, _listener: ISignInListener): Promise<void> {
    return Promise.reject(new Error("The fixture signs no one in."));
  }

  public listModels(_provider: Provider | null): Promise<ProviderModelList> {
    return Promise.resolve(new ProviderModelList([], true));
  }

  public runTurn(_request: TurnRequest, _listener: ITurnListener, _signal: AbortSignal): Promise<TurnResult> {
    return Promise.reject(new Error("The fixture runs no turns."));
  }

  public forkSession(_request: ForkRequest): Promise<ForkedSession> {
    return Promise.reject(new Error("The fixture forks no sessions."));
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
