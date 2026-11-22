/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterRenderEffect, Component, effect, type InputSignal, input, type OutputEmitterRef, output, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import { OrganizationFlowStage } from "../../enums/organization-flow-stage";
import { FlowDrawing } from "../../models/flow-drawing";
import { FlowRoute } from "../../models/flow-route";
import type { OrganizationFlow } from "../../models/organization-flow";
import { TreeFlowLines } from "../../models/tree-flow-lines";

@Component({
  selector: "nol-teamrun-flow-overlay",
  host: { "class": "nol-teamrun-flow-overlay", "aria-hidden": "true" },
  templateUrl: "./flow-overlay.component.html",
  styleUrl: "./flow-overlay.component.css"
})
export class FlowOverlayComponent {
  private readonly drawn: WritableSignal<readonly FlowDrawing[]> = signal([]);
  private readonly resizes: WritableSignal<number> = signal(0);

  public readonly container: InputSignal<HTMLElement> = input.required<HTMLElement>();
  public readonly flows: InputSignal<readonly OrganizationFlow[]> = input<readonly OrganizationFlow[]>([]);
  public readonly arrived: OutputEmitterRef<string> = output<string>();
  public readonly finished: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly stages: typeof OrganizationFlowStage = OrganizationFlowStage;
  protected readonly drawings: Signal<readonly FlowDrawing[]> = this.drawn.asReadonly();

  public constructor() {
    afterRenderEffect({
      read: () => {
        this.resizes();
        this.drawn.set(this.draw(this.container(), this.flows()));
      }
    });
    effect(onCleanup => {
      const observer = new ResizeObserver(() => this.resizes.update(t => t + 1));
      observer.observe(this.container());
      onCleanup(() => observer.disconnect());
    });
  }

  private draw(container: HTMLElement, flows: readonly OrganizationFlow[]): readonly FlowDrawing[] {
    const nodes = TreeFlowLines.nodesIn(container);
    return flows.flatMap(t => {
      const route = FlowRoute.between(nodes, t.fromKey, t.toKey);
      return Object.isNull(route) ? [] : [new FlowDrawing(t, route)];
    });
  }
}
