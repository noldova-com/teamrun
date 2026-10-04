/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlayContainer } from "@angular/cdk/overlay";

import { GalleryResources } from "./gallery-resources";

export class GalleryOverlayContainer extends OverlayContainer {
  private readonly scope: HTMLElement;

  public constructor(scope: HTMLElement) {
    super();
    this.scope = scope;
  }

  protected override _createContainer(): void {
    const container = this._document.createElement("div");
    container.classList.add(GalleryResources.overlayContainerClass);
    this.scope.append(container);
    this._containerElement = container;
  }
}
