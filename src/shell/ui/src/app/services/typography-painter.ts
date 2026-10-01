/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FontChoice } from "../enums/font-choice";
import type { Typography } from "../models/typography";
import { Resources } from "../../resources";

export class TypographyPainter {
  public static paint(element: HTMLElement, typography: Typography): void {
    const style = element.style;
    style.setProperty(Resources.fontSizeProperty, `${typography.rootSize}px`);
    style.setProperty(Resources.messageSizeVariable, `${typography.messageSize}px`);
    style.setProperty(Resources.codeSizeVariable, `${typography.codeSize}px`);
    style.setProperty(Resources.sansFontVariable, typography.interfaceFont === FontChoice.System ? Resources.systemSansFonts : Resources.noldovaSansFonts);
    style.setProperty(Resources.monoFontVariable, typography.codeFont === FontChoice.System ? Resources.systemMonoFonts : Resources.noldovaMonoFonts);
  }
}
