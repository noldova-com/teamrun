/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentRef, createComponent, type DestroyRef, type EnvironmentInjector, Injectable, type Injector } from "@angular/core";

import { HistoryWarmUpComponent } from "../components/history-warm-up/history-warm-up.component";
import type { IWaitingHistory } from "../interfaces/i-waiting-history";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class HistoryWarmUpService {
  private readonly waiting: IWaitingHistory[] = [];
  private hasRun: boolean = false;
  private request: { readonly id: number; readonly history: IWaitingHistory } | null = null;

  public schedule(environment: EnvironmentInjector, injector: Injector, destroyRef: DestroyRef): void {
    if (this.hasRun)
      return;
    const history: IWaitingHistory = { environment, injector, destroyRef };
    this.waiting.push(history);
    destroyRef.onDestroy(() => this.leave(history));
    this.ask();
  }

  private ask(): void {
    const history = this.waiting[0];
    if (this.hasRun || !Object.isNull(this.request) || Object.isUndefined(history))
      return;
    const id = requestIdleCallback(() => {
      this.request = null;
      this.hasRun = true;
      this.waiting.splice(0);
      HistoryWarmUpService.render(history);
    });
    this.request = { id, history };
  }

  private leave(history: IWaitingHistory): void {
    const index = this.waiting.indexOf(history);
    if (index >= 0)
      this.waiting.splice(index, 1);
    if (this.request?.history !== history)
      return;
    cancelIdleCallback(this.request.id);
    this.request = null;
    this.ask();
  }

  private static render(history: IWaitingHistory): void {
    const host = document.body.appendChild(document.createElement(Resources.historyWarmUpTag));
    let isDone = false;
    let warmUp: ComponentRef<HistoryWarmUpComponent> | null = null;
    const end = (): void => {
      if (isDone)
        return;
      isDone = true;
      warmUp?.destroy();
      host.remove();
    };
    const stop = history.destroyRef.onDestroy(end);
    requestAnimationFrame(() => {
      stop();
      end();
    });
    warmUp = createComponent(HistoryWarmUpComponent, { environmentInjector: history.environment, elementInjector: history.injector, hostElement: host });
    warmUp.changeDetectorRef.detectChanges();
  }
}
