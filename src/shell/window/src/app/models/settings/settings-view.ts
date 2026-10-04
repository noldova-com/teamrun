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
  public readonly pageListTop: number;
  public readonly contentTop: number;

  public constructor(page: string, query: string, pageListTop: number, contentTop: number) {
    this.page = page;
    this.query = query;
    this.pageListTop = pageListTop;
    this.contentTop = contentTop;
  }
}
