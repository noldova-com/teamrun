/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { TestBed } from "@angular/core/testing";

import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { WindowPartActivation } from "../../../src/app/models/window-part-activation";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

class NotesPart implements IWindowPart {
  public readonly moduleId: string = "notes";

  public activateAsync(): Promise<void> {
    return Promise.resolve();
  }

  public reconnectAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public deactivateAsync(): Promise<void> {
    return Promise.resolve();
  }
}

describe("WindowPartActivation", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  it("holds an active window part with its source and context", () => {
    const part = new NotesPart();
    const source = new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.resolve(part));
    const context = new WindowPartContext(source, TestBed.inject(WindowPartHostService));

    const activation = new WindowPartActivation(source, context, part);

    expect([activation.source, activation.context, activation.part]).toEqual([source, context, part]);
  });
});
