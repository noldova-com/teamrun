/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, type ComponentRef, DestroyRef, ViewContainerRef, effect, inject, input } from "@angular/core";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { ContextMenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { PlaceMenuComponent } from "../components/place-menu/place-menu.component";
import { WindowPartAccessException } from "../exceptions/window-part-access.exception";
import { WindowPartTokens } from "../models/window-part-tokens";
import { Resources } from "../../resources";

@Directive({
  selector: "[trMenu]",
  hostDirectives: [ContextMenuTriggerDirective]
})
export class MenuDirective {
  public readonly place = input.required<string>({ alias: "trMenu" });
  public readonly context = input<JsonObject>({}, { alias: "trMenuContext" });

  public constructor() {
    const owner = inject(WindowPartTokens.context);
    const trigger = inject(ContextMenuTriggerDirective, { self: true });
    const menu: ComponentRef<PlaceMenuComponent> = inject(ViewContainerRef).createComponent(PlaceMenuComponent);
    inject(DestroyRef).onDestroy(() => menu.destroy());
    effect(() => {
      const place = this.place();
      if (!owner.isAllowed(place))
        throw new WindowPartAccessException(Resources.formatForeignMenu(place));
      menu.setInput(Resources.placeInput, place);
      menu.setInput(Resources.contextInput, this.context());
      menu.changeDetectorRef.detectChanges();
      trigger.menuTemplateRef = menu.instance.menu();
    });
  }
}
