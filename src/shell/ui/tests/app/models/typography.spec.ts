/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { FontChoice } from "../../../src/app/enums/font-choice";
import { Typography } from "../../../src/app/models/typography";

describe("Typography", () => {
  it("defaults to 13 pixel panels, 14 pixel messages and code, and the Noldova fonts", () => {
    const typography = new Typography();

    expect(typography.panelSize).toBe(13);
    expect(typography.messageSize).toBe(14);
    expect(typography.codeSize).toBe(14);
    expect(typography.interfaceFont).toBe(FontChoice.Noldova);
    expect(typography.codeFont).toBe(FontChoice.Noldova);
    expect(typography.rootSize).toBe(16);
  });

  it("keeps chosen sizes and fonts and derives the root size from the panel size", () => {
    const typography = new Typography(12, 18, 15, FontChoice.System, FontChoice.System);

    expect([typography.panelSize, typography.messageSize, typography.codeSize]).toEqual([12, 18, 15]);
    expect(typography.interfaceFont).toBe(FontChoice.System);
    expect(typography.codeFont).toBe(FontChoice.System);
    expect(typography.rootSize).toBeCloseTo(16 * 12 / 13, 10);
    expect(new Typography(18).rootSize).toBeCloseTo(16 * 18 / 13, 10);
  });

  it("refuses sizes outside 12 to 18 pixels, naming the size", () => {
    const cases: readonly (readonly [() => Typography, string])[] = [
      [() => new Typography(11.5), "panelSize"],
      [() => new Typography(13, 18.5), "messageSize"],
      [() => new Typography(13, 14, Number.NaN), "codeSize"],
      [() => new Typography(Number.POSITIVE_INFINITY), "panelSize"]
    ];

    for (const [create, parameterName] of cases) {
      let caught: unknown;
      try {
        create();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ArgumentOutOfRangeException);
      expect((caught as ArgumentOutOfRangeException).parameterName).toBe(parameterName);
      expect((caught as ArgumentOutOfRangeException).message).toContain(`The ${parameterName} must be from 12 to 18 CSS pixels`);
    }
  });
});
