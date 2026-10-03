/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FontChoice } from "../../../src/app/enums/font-choice";
import { Typography } from "../../../src/app/models/typography";
import { TypographyPainter } from "../../../src/app/services/typography-painter";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";

describe("TypographyPainter", () => {
  afterEach(() => AppearanceFixture.reset());

  it("paints the root size, the message and code sizes and the Noldova font stacks", () => {
    const element = document.createElement("div");

    TypographyPainter.paint(element, new Typography(12, 17, 15));

    expect(Number.parseFloat(element.style.fontSize)).toBeCloseTo(16 * 12 / 13, 3);
    expect(element.style.getPropertyValue("--tr-text-message")).toBe("17px");
    expect(element.style.getPropertyValue("--tr-text-code")).toBe("15px");
    expect(element.style.getPropertyValue("--tr-font-sans")).toBe("\"Noldova Sans\", system-ui, \"Segoe UI\", Roboto, sans-serif");
    expect(element.style.getPropertyValue("--tr-font-mono")).toBe("\"Noldova Mono\", ui-monospace, \"Cascadia Mono\", Consolas, monospace");
  });

  it("changes only the chosen font stack to the system's", () => {
    const element = document.createElement("div");

    TypographyPainter.paint(element, new Typography(13, 14, 14, FontChoice.System, FontChoice.Noldova));
    expect(element.style.getPropertyValue("--tr-font-sans")).toBe("system-ui, \"Segoe UI\", Roboto, sans-serif");
    expect(element.style.getPropertyValue("--tr-font-mono")).toContain("Noldova Mono");

    TypographyPainter.paint(element, new Typography(13, 14, 14, FontChoice.Noldova, FontChoice.System));
    expect(element.style.getPropertyValue("--tr-font-sans")).toContain("Noldova Sans");
    expect(element.style.getPropertyValue("--tr-font-mono")).toBe("ui-monospace, \"Cascadia Mono\", Consolas, monospace");
  });

  it("erases everything it painted and nothing else", () => {
    const element = document.createElement("div");
    element.style.setProperty("--other", "kept");
    TypographyPainter.paint(element, new Typography(12, 17, 15));

    TypographyPainter.erase(element);

    expect([...element.style]).toEqual(["--other"]);
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`makes panel ${panelSize} pixels and derives the label size and line heights at the root`, () => {
      AppearanceFixture.apply(undefined, undefined, panelSize);
      const probe = document.createElement("span");
      document.body.append(probe);
      const measure = (fontSize: string, lineHeight: string): readonly [number, number] => {
        probe.style.fontSize = fontSize;
        probe.style.lineHeight = lineHeight;
        const style = getComputedStyle(probe);
        return [Number.parseFloat(style.fontSize), Number.parseFloat(style.lineHeight)];
      };

      const [panel, panelLine] = measure("var(--tr-text-panel)", "var(--tr-line-panel)");
      const [label, labelLine] = measure("var(--tr-text-label)", "var(--tr-line-label)");
      const [, tooltipLine] = measure("var(--tr-text-label)", "var(--tr-line-tooltip)");
      const [heading, headingLine] = measure("var(--tr-text-heading)", "var(--tr-line-heading)");
      probe.remove();

      const rem = 16 * panelSize / 13;
      expect(panel).toBeCloseTo(panelSize, 2);
      expect(panelLine).toBeCloseTo(Math.max(1.125 * rem, panelSize + 0.3125 * rem), 2);
      expect(label).toBeCloseTo(Math.max(12, panelSize - 0.0625 * rem), 2);
      expect(labelLine).toBeCloseTo(label + 0.25 * rem, 2);
      expect(tooltipLine).toBeCloseTo(label + 0.4375 * rem, 2);
      expect(heading).toBeCloseTo(panelSize * 2, 2);
      expect(headingLine).toBeCloseTo(panelSize * 2 * 1.25, 2);
    });
});
