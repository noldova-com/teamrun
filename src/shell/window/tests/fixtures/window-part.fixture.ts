/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ContentPadding } from "../../src/app/enums/content-padding";
import type { IWindowPartContext } from "../../src/app/interfaces/i-window-part-context";
import type { IWindowPart } from "../../src/app/interfaces/i-window-part";

export class WindowPartFixture implements IWindowPart {
  private readonly log: string[];
  private readonly onActivate: (context: IWindowPartContext) => void;

  public readonly moduleId: string;
  public padding?: ContentPadding;
  public isDeactivationFailing: boolean = false;
  public onReconnect: () => boolean = () => false;

  public constructor(moduleId: string, log: string[], onActivate: (context: IWindowPartContext) => void = () => undefined) {
    this.moduleId = moduleId;
    this.log = log;
    this.onActivate = onActivate;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    this.log.push(`activate ${this.moduleId}`);
    await Promise.resolve();
    this.onActivate(context);
  }

  public async reconnectAsync(): Promise<boolean> {
    this.log.push(`reconnect ${this.moduleId}`);
    await Promise.resolve();
    return this.onReconnect();
  }

  public deactivateAsync(): Promise<void> {
    this.log.push(`deactivate ${this.moduleId}`);
    return this.isDeactivationFailing ? Promise.reject(new Error(`${this.moduleId} did not stop`)) : Promise.resolve();
  }
}
