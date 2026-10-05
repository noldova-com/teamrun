/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { QuitChoice } from "../../../src/app/enums/quit-choice";
import { QuitQuestion } from "../../../src/app/models/quit-question";
import { QuitService } from "../../../src/app/services/quit.service";
import { QuitFixture } from "../../fixtures/quit.fixture";

describe("QuitService", () => {
  let quit: QuitFixture;

  beforeEach(() => {
    quit = QuitFixture.start();
  });

  afterEach(async () => {
    await quit.endAsync();
  });

  it("follows the question the desktop asks and passes on each answer", async () => {
    const service = TestBed.inject(QuitService);
    const initial = service.question();

    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true });
    await vi.waitFor(() => expect(service.question()).not.toBeNull());
    service.answer(QuitChoice.Stop);

    expect(initial).toBeNull();
    expect(service.question()).toEqual(new QuitQuestion(["Indexing the project"], true));
    await vi.waitFor(() => expect(quit.bridge.quitAnswers).toEqual(["Stop"]));
  });

  it("closes when the desktop takes the question away and returns focus to where it was", async () => {
    quit.bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: false });
    await vi.waitFor(() => expect(QuitFixture.dialog()).not.toBeNull());

    quit.bridge.askToQuit(null);
    quit.bridge.askToQuit(null);

    await vi.waitFor(() => expect(QuitFixture.dialog()).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(quit.opener));
    expect(quit.bridge.quitAnswers).toEqual([]);
  });
});
