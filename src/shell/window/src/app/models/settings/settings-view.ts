/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";

export class SettingsView {
  public static readonly initial: SettingsView = new SettingsView(Resources.appearancePage, String.empty, 0, 0);

  public readonly page: string;
  public readonly query: string;
  public readonly pagesTop: number;
  public readonly contentTop: number;

  public constructor(page: string, query: string, pagesTop: number, contentTop: number) {
    this.page = page;
    this.query = query;
    this.pagesTop = pagesTop;
    this.contentTop = contentTop;
  }
}
