/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartContextHostFixture } from "../../fixtures/window-part-context-host.fixture";
import { WindowPartFixture } from "../../fixtures/window-part.fixture";

@Component({ template: "" })
class ListComponent {
}

describe("ContributionMatch", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(ListComponent);

  it("holds how to load a module's contribution and the context of the window part that registered it", () => {
    const source = new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.resolve(new WindowPartFixture("notes", [])));
    const context = new WindowPartContext(source, new WindowPartContextHostFixture());

    const match = new ContributionMatch(load, context);

    expect(match.loadComponent).toBe(load);
    expect(match.context).toBe(context);
  });

  it("has no context for a shell document, which no window part registered", () => {
    expect(new ContributionMatch(load, null).context).toBeNull();
  });
});
