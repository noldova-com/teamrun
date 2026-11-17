/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { EmulatedMediaFixture } from "../../fixtures/emulated-media.fixture";
import { Wait } from "../../fixtures/wait.fixture";
import { MotionPreferenceService } from "../../../src/app/services/motion-preference.service";

describe("MotionPreferenceService", () => {
  afterEach(async () => {
    await EmulatedMediaFixture.resetAsync();
  });

  it("reads whether reduced motion is preferred and follows a change to it", async () => {
    const motion = TestBed.inject(MotionPreferenceService);
    expect(motion.reduced()).toBe(false);

    await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
    await Wait.until(() => expect(motion.reduced()).toBe(true));

    await EmulatedMediaFixture.resetAsync();
    await Wait.until(() => expect(motion.reduced()).toBe(false));
  });
});
