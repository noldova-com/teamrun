/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEveryRender, Component, effect, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import { FlowLayout } from "../../enums/flow-layout";
import { OrganizationFlowStage } from "../../enums/organization-flow-stage";
import { CardFlowLines } from "../../models/card-flow-lines";
import { FlowDrawing } from "../../models/flow-drawing";
import { FlowRoute } from "../../models/flow-route";
import type { OrganizationFlow } from "../../models/organization-flow";
import { TreeFlowLines } from "../../models/tree-flow-lines";

@Component({
  selector: "nol-teamrun-flow-overlay",
  host: { "class": "nol-teamrun-flow-overlay", "aria-hidden": "true", "[class.cards]": "layout() === layouts.Cards" },
  templateUrl: "./flow-overlay.component.html",
  styleUrl: "./flow-overlay.component.css"
})
export class FlowOverlayComponent {
  private readonly drawn: WritableSignal<readonly FlowDrawing[]> = signal([]);

  public readonly container: InputSignal<HTMLElement> = input.required<HTMLElement>();
  public readonly flows: InputSignal<readonly OrganizationFlow[]> = input<readonly OrganizationFlow[]>([]);
  public readonly layout: InputSignal<FlowLayout> = input<FlowLayout>(FlowLayout.Tree);
  public readonly chat: InputSignal<HTMLElement | null> = input<HTMLElement | null>(null);
  public readonly colors: InputSignal<ReadonlyMap<string, string>> = input<ReadonlyMap<string, string>>(new Map());
  public readonly arrived: OutputEmitterRef<string> = output<string>();
  public readonly finished: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly stages: typeof OrganizationFlowStage = OrganizationFlowStage;
  protected readonly layouts: typeof FlowLayout = FlowLayout;
  protected readonly drawings: Signal<readonly FlowDrawing[]> = this.drawn.asReadonly();

  public constructor() {
    afterEveryRender({ read: () => this.redraw() });
    effect(onCleanup => {
      const observer = new ResizeObserver(() => this.redraw());
      observer.observe(this.container());
      onCleanup(() => observer.disconnect());
    });
  }

  protected colorOf(flow: OrganizationFlow): string | null {
    const colors = this.colors();
    return colors.get(flow.toKey) ?? colors.get(flow.fromKey) ?? null;
  }

  private redraw(): void {
    const drawings = this.draw(this.container(), this.flows());
    if (!FlowDrawing.sameAll(this.drawn(), drawings))
      this.drawn.set(drawings);
  }

  private draw(container: HTMLElement, flows: readonly OrganizationFlow[]): readonly FlowDrawing[] {
    if (flows.length === 0)
      return [];
    const between = this.routesIn(container);
    return flows.flatMap(t => {
      const route = between(t.fromKey, t.toKey);
      return Object.isNull(route) ? [] : [new FlowDrawing(t, route)];
    });
  }

  private routesIn(container: HTMLElement): (fromKey: string, toKey: string) => FlowRoute | null {
    if (this.layout() === FlowLayout.Cards) {
      const cards = CardFlowLines.of(container, this.chat());
      return (t, u) => cards.between(t, u);
    }
    const nodes = TreeFlowLines.nodesIn(container);
    return (t, u) => FlowRoute.between(nodes, t, u);
  }
}
