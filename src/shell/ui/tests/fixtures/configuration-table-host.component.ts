/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";

import { ButtonComponent } from "../../src/app/components/button/button.component";
import { ConfigurationTableActionDirective } from "../../src/app/components/configuration-table/configuration-table-action.directive";
import { ConfigurationTableComponent } from "../../src/app/components/configuration-table/configuration-table.component";
import { ConfigurationTableDirective } from "../../src/app/components/configuration-table/configuration-table.directive";
import { ConfigurationTableFillDirective } from "../../src/app/components/configuration-table/configuration-table-fill.directive";

@Component({
  imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective],
  template: `
    <tr-configuration-table [style.width]="width()" [heading]="heading()" [label]="label()" [level]="level()" [explanation]="explanation()">
      @if (hasAction()) {
        <button type="button" class="add" tr-button trConfigurationTableAction>Add</button>
      }
      <table trConfigurationTable>
        <thead>
          <tr><th scope="col">Name</th><th scope="col" trConfigurationTableFill>Value</th><th scope="col">Scope</th><th scope="col" aria-label="Actions"></th></tr>
        </thead>
        <tbody>
          <tr class="short"><td>EDITOR</td><td trConfigurationTableFill>code</td><td>Every project</td><td><button type="button" class="remove" tr-button>Remove</button></td></tr>
          <tr class="long"><td>NOTES_HOME</td><td trConfigurationTableFill>{{ value() }}</td><td>This project</td><td><button type="button" tr-button>Remove</button></td></tr>
        </tbody>
      </table>
    </tr-configuration-table>
  `
})
export class ConfigurationTableHostComponent {
  public readonly width = signal("40rem");
  public readonly heading = signal("Environment variables");
  public readonly label = signal("");
  public readonly level = signal(3);
  public readonly explanation = signal("Each variable is set for the programs the shell starts.");
  public readonly hasAction = signal(true);
  public readonly value = signal("A value that is far too long to fit the width of its cell, so its row grows to hold it");
}
