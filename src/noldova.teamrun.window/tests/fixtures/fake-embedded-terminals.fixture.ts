/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EnvironmentInjector } from "@angular/core";

import type { IEmbeddedTerminal } from "../../src/app/interfaces/i-embedded-terminal";
import type { IEmbeddedTerminalOpener } from "../../src/app/interfaces/i-embedded-terminal-opener";

export class FakeEmbeddedTerminals implements IEmbeddedTerminalOpener {
  private refusal: Error | null = null;

  public readonly opens: { readonly sessionId: string; readonly injector: EnvironmentInjector; readonly maximumRows: number }[] = [];
  public readonly focused: string[] = [];
  public readonly disposed: string[] = [];

  public refuse(error: Error): this {
    this.refusal = error;
    return this;
  }

  public open(sessionId: string, injector: EnvironmentInjector, maximumRows: number): IEmbeddedTerminal {
    if (!Object.isNull(this.refusal))
      throw this.refusal;
    this.opens.push({ sessionId, injector, maximumRows });
    const element = document.createElement("div");
    element.className = "nol-teamrun-fake-terminal";
    element.style.blockSize = "10rem";
    element.textContent = sessionId;
    return { element, focus: () => this.focused.push(sessionId), dispose: () => this.disposed.push(sessionId) };
  }
}
