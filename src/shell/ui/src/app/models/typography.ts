/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { FontChoice } from "../enums/font-choice";
import { Resources } from "../../resources";

export class Typography {
  public readonly panelSize: number;
  public readonly messageSize: number;
  public readonly codeSize: number;
  public readonly interfaceFont: FontChoice;
  public readonly codeFont: FontChoice;

  public constructor(
    panelSize: number = Resources.defaultPanelSize,
    messageSize: number = Resources.defaultMessageSize,
    codeSize: number = Resources.defaultCodeSize,
    interfaceFont: FontChoice = FontChoice.Noldova,
    codeFont: FontChoice = FontChoice.Noldova) {
    Typography.validateSize(panelSize, Resources.panelSizeParameter);
    Typography.validateSize(messageSize, Resources.messageSizeParameter);
    Typography.validateSize(codeSize, Resources.codeSizeParameter);

    this.panelSize = panelSize;
    this.messageSize = messageSize;
    this.codeSize = codeSize;
    this.interfaceFont = interfaceFont;
    this.codeFont = codeFont;
  }

  public get rootSize(): number {
    return Resources.defaultRootSize * this.panelSize / Resources.defaultPanelSize;
  }

  private static validateSize(size: number, parameterName: string): void {
    if (!Number.isFinite(size) || size < Resources.minimumTextSize || size > Resources.maximumTextSize)
      throw new ArgumentOutOfRangeException(parameterName, size, Resources.formatTextSizeOutOfRange(parameterName, size));
  }
}
