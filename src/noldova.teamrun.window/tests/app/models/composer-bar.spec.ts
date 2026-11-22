/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AccessWidths } from "../../../src/app/models/access-widths";
import { ComposerBar } from "../../../src/app/models/composer-bar";
import { FoldWidths } from "../../../src/app/models/fold-widths";

describe("ComposerBar", () => {
  const gaugeWidths = new FoldWidths(117, 40);
  const bar = (width: number, gauge: FoldWidths | null = gaugeWidths, line: number | null = 140, cardMaxWidth: number = 880): ComposerBar =>
    new ComposerBar(width, new FoldWidths(64, 16), cardMaxWidth, 26, 4, 48, new AccessWidths(120, 38, 26), gauge, new FoldWidths(180, 70), line);

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
    expect([bar(2_000).fold(), bar(2_000, gaugeWidths, 140, 400).fold()]).toEqual([ComposerBar.unfolded, ComposerBar.buttonShort]);
  });

  it("keeps what it measured", () => {
    const measured = bar(400);

    expect([measured.width, measured.insets, measured.cardMaxWidth, measured.cardChrome, measured.gap, measured.ends, measured.access, measured.gauge, measured.picker,
      measured.line]).toEqual([400, new FoldWidths(64, 16), 880, 26, 4, 48, new AccessWidths(120, 38, 26), new FoldWidths(117, 40), new FoldWidths(180, 70), 140]);
  });
});
