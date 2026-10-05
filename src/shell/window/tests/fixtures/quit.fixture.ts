/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { QuitService } from "../../src/app/services/quit.service";
import { DesktopBridgeFixture } from "./desktop-bridge.fixture";

export class QuitFixture {
  public readonly bridge: DesktopBridgeFixture;
  public readonly opener: HTMLButtonElement;
  public readonly stopListening: () => void;

  private constructor(bridge: DesktopBridgeFixture, opener: HTMLButtonElement, stopListening: () => void) {
    this.bridge = bridge;
    this.opener = opener;
    this.stopListening = stopListening;
  }

  public static start(): QuitFixture {
    const bridge = DesktopBridgeFixture.install();
    const opener = document.createElement("button");
    opener.textContent = "Close";
    document.body.append(opener);
    opener.focus();
    return new QuitFixture(bridge, opener, TestBed.inject(QuitService).listen());
  }

  public static findDialog(): HTMLElement | null {
    return document.querySelector("[role=dialog]");
  }

  public async endAsync(): Promise<void> {
    this.bridge.askToQuit(null);
    this.stopListening();
    await vi.waitFor(() => expect(document.querySelector("tr-quit-dialog")).toBeNull());
    this.opener.remove();
    DesktopBridgeFixture.remove();
  }
}
