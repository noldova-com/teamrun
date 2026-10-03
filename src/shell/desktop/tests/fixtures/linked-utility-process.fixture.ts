/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DetachedStart, type IParentPort, type IUtilityProcess } from "@noldova/teamrun-shell-desktop";
import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

export class LinkedUtilityProcess implements IUtilityProcess {
  private readonly starter: IProcessStarter;
  private readonly listeners: Map<string, (value: unknown) => void> = new Map();
  private readonly acknowledgements: (() => void)[] = [];
  private isStarted: boolean = false;

  private readonly port: IParentPort = {
    postMessage: (message: unknown) => void setImmediate(() => this.emit("message", message)),
    once: (_event: "message", listener: () => void) => this.acknowledgements.push(listener)
  };

  public constructor(starter: IProcessStarter) {
    this.starter = starter;
  }

  public postMessage(message: unknown): void {
    setImmediate(() => {
      if (this.isStarted) {
        this.acknowledgements.shift()?.();
        return;
      }
      this.isStarted = true;
      void DetachedStart.runAsync(message, this.port, this.starter).then(() => this.emit("exit", 0));
    });
  }

  public once(event: "message" | "exit", listener: (value: unknown) => void): this {
    this.listeners.set(event, listener);
    return this;
  }

  private emit(event: "message" | "exit", value: unknown): void {
    const listener = this.listeners.get(event);
    this.listeners.delete(event);
    listener?.(value);
  }
}
