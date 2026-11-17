/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComposerBar } from "../../../src/app/models/composer-bar";

describe("ComposerBar", () => {
  const bar = (width: number, gauge: readonly [number, number] | null = [117, 40], line: number | null = 140, cardMaxWidth: number = 880): ComposerBar =>
    new ComposerBar(width, [64, 16], cardMaxWidth, 26, 4, 48, [120, 38, 26], gauge, [180, 70], line);

  it("hides the provider line, then folds the inset, then shortens the picker as the permissions' label goes, then the gauge's label, then the permissions' expand glyph, then the permissions into the picker's menu, each where what the bar holds stops fitting", () => {
    expect([719, 718.9, 575, 574.9, 527, 526.9, 335, 334.9, 258, 257.9, 246, 245.9, 150].map(t => bar(t).fold())).toEqual([ComposerBar.unfolded, ComposerBar.lineHidden,
      ComposerBar.lineHidden, ComposerBar.tight, ComposerBar.tight, ComposerBar.buttonShort, ComposerBar.buttonShort, ComposerBar.gaugeTrack, ComposerBar.gaugeTrack,
      ComposerBar.accessIcon, ComposerBar.accessIcon, ComposerBar.accessInMenu, ComposerBar.accessInMenu]);
  });

  it("leaves out the line, the gauge and their gaps while the chat has neither, so the inset folds first and the permissions' glyph after the picker", () => {
    expect([454, 453.9, 406, 405.9, 214, 213.9, 202, 201.9].map(t => bar(t, null, null).fold())).toEqual([ComposerBar.unfolded, ComposerBar.tight, ComposerBar.tight,
      ComposerBar.buttonShort, ComposerBar.buttonShort, ComposerBar.accessIcon, ComposerBar.accessIcon, ComposerBar.accessInMenu]);
  });

  it("measures the room within the card's widest size", () => {
    expect([bar(2_000).fold(), bar(2_000, [117, 40], 140, 400).fold()]).toEqual([ComposerBar.unfolded, ComposerBar.buttonShort]);
  });

  it("keeps what it measured", () => {
    const measured = bar(400);

    expect([measured.width, measured.insets, measured.cardMaxWidth, measured.cardChrome, measured.gap, measured.ends, measured.access, measured.gauge, measured.picker,
      measured.line]).toEqual([400, [64, 16], 880, 26, 4, 48, [120, 38, 26], [117, 40], [180, 70], 140]);
  });
});
