/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiServer from "../../api/api-server.ts";
import AngularFileCheck from "../../checks/angular-file-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SyntaxTreeReader from "../../structure/syntax-tree.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class AngularFileCheckTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly APP: string = "src/shell/ui/src/app";
  private static readonly TEMPLATE: string = "<ng-content />\n";
  private static readonly RULE: string = "; CODING-STANDARDS.md section 5 puts each component in src/app/components/<folder>/<name>.component.ts with its template beside it, and each @Injectable service in <name>.service.ts.";

  public static register(): void {
    test("components in their folders with their templates, services in their files and other classes pass, outside test folders and declarations", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const app = AngularFileCheckTests.APP;
      const template = AngularFileCheckTests.TEMPLATE;
      await repository.writeAsync({
        [`${app}/components/menu/menu.component.ts`]: [
          "@Component({ selector: \"tr-menu\", templateUrl: \"./menu.component.html\" }) export class MenuComponent {}",
          "export const note = \"@Component({ selector: \\\"tr-note\\\" }) class Wrong {}\";",
          "class Panel {}",
          ""
        ].join("\n"),
        [`${app}/components/menu/menu.component.html`]: template,
        [`${app}/components/menu/menu-item.component.ts`]: "@Component({ templateUrl: \"./menu-item.component.html\" }) export class MenuItemComponent {}\n",
        [`${app}/components/menu/menu-item.component.html`]: template,
        [`${app}/directives/menu-trigger.directive.ts`]: "@Directive({ selector: \"[trMenuTrigger]\" }) export class MenuTriggerDirective {}\n",
        [`${app}/services/focus-trap.service.ts`]: "@Injectable({ providedIn: \"root\" }) export class FocusTrapService {}\n",
        [`${app}/models/clock.ts`]: "@Injectable() export class Clock {}\n@sealed export class Sealed {}\n@ng.Component({}) export class Qualified {}\n",
        [`${app}/index.d.ts`]: "export declare class Wrong {}\n",
        "src/shell/ui/src/main.ts": "@Component({}) export class Root {}\n",
        "src/shell/desktop/tests/fixtures/modules/clock/window/src/app/broken.component.ts": "export {};\n"
      });
      const output = new TextOutputFixture();

      const check = AngularFileCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the component and service names of 5 Angular files.\n");
      assert.equal(check.title, "Angular files");
    });

    test("a misnamed, misplaced or template-less component and a misfiled service fail with where they are", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const app = AngularFileCheckTests.APP;
      const template = AngularFileCheckTests.TEMPLATE;
      await repository.writeAsync({
        [`${app}/components/badge/badge.ts`]: "@Component({ templateUrl: \"./badge.component.html\" }) export class BadgeComponent {}\n",
        [`${app}/components/card.component.ts`]: "@Component({ templateUrl: \"./card.component.html\" }) export class CardComponent {}\n",
        [`${app}/components/card.component.html`]: template,
        [`${app}/components/chip/chip.component.ts`]: "export class ChipComponent {}\n",
        [`${app}/components/list/list.component.ts`]: [
          "@Component() export class ListComponent {}",
          "@Component(options) class ListComponent {}",
          "@Component({ templateUrl }) class ListComponent {}",
          "@Component({ \"templateUrl\": \"./list.component.html\" }) class ListComponent {}",
          "@Component({ selector: \"tr-list\", templateUrl: url }) class ListComponent {}",
          "@Component({ templateUrl: \"./list.html\" }) class ListComponent {}",
          ""
        ].join("\n"),
        [`${app}/components/list/list.component.html`]: template,
        [`${app}/components/menu/menu.component.ts`]: "@Component({ templateUrl: \"./menu.component.html\" }) export class MenuPanelComponent {}\n",
        [`${app}/components/menu/popup.component.ts`]: "@Component({ templateUrl: \"./popup.component.html\" }) export class PopupComponent {}\n",
        [`${app}/components/menu/popup.component.html`]: template,
        [`${app}/components/tab/tab.component.ts`]: "@Component({ templateUrl: \"./tab.component.html\" }) export default class {}\n",
        [`${app}/components/tab/tab.component.html`]: template,
        [`${app}/services/clock.service.ts`]: "@Injectable() export class Clock {}\n",
        [`${app}/services/focus.ts`]: "@Injectable({ providedIn: \"root\" }) export class FocusTrapService {}\n",
        [`${app}/widgets/components/badge/badge.component.ts`]: "@Component({ templateUrl: \"./badge.component.html\" }) export class BadgeComponent {}\n",
        [`${app}/widgets/components/badge/badge.component.html`]: template
      });
      const output = new TextOutputFixture();

      assert.equal(await AngularFileCheckTests.createCheck(repository).runAsync(output), false);
      const rule = AngularFileCheckTests.RULE;
      const folder = "is not in src/app/components/<folder>/ with a file name that starts with the folder name";
      const list = `the component ListComponent does not name ./list.component.html as its templateUrl${rule}`;
      assert.equal(output.text, [
        `${app}/components/badge/badge.ts:1: the component BadgeComponent is not in a <name>.component.ts file${rule}`,
        `${app}/components/card.component.ts:1: the component CardComponent ${folder}${rule}`,
        `${app}/components/chip/chip.component.ts: holds no @Component class${rule}`,
        `${app}/components/list/list.component.ts:1: ${list}`,
        `${app}/components/list/list.component.ts:2: ${list}`,
        `${app}/components/list/list.component.ts:3: ${list}`,
        `${app}/components/list/list.component.ts:4: ${list}`,
        `${app}/components/list/list.component.ts:5: ${list}`,
        `${app}/components/list/list.component.ts:6: ${list}`,
        `${app}/components/menu/menu.component.ts:1: the component MenuPanelComponent is not named MenuComponent for its file${rule}`,
        `${app}/components/menu/menu.component.ts:1: the component MenuPanelComponent names ./menu.component.html, which is not in the repository${rule}`,
        `${app}/components/menu/popup.component.ts:1: the component PopupComponent ${folder}${rule}`,
        `${app}/components/tab/tab.component.ts:1: the component (anonymous) is not named TabComponent for its file${rule}`,
        `${app}/services/clock.service.ts: holds no @Injectable class whose name ends in Service${rule}`,
        `${app}/services/focus.ts:1: the service FocusTrapService is not in its file focus-trap.service.ts${rule}`,
        `${app}/widgets/components/badge/badge.component.ts:1: the component BadgeComponent ${folder}${rule}`,
        "Checked the component and service names of 10 Angular files.",
        ""
      ].join("\n"));
    });

    test("a TypeScript API that cannot start fails the check with its reason, and any other error reaches the caller", async t => {
      const repository = await RepositoryFixture.createAsync();
      const file = `${AngularFileCheckTests.APP}/services/clock.service.ts`;
      const source = "@Injectable() export class ClockService {}\n";
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [file]: source });
      const output = new TextOutputFixture();
      const files = new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()));
      const stopping = new SyntaxTreeReader(repository.directory, [process.execPath, "-e", "process.exit(3)", "--"], AngularFileCheckTests.TIMEOUT);

      assert.equal(await new AngularFileCheck(files, stopping).runAsync(output), false);
      assert.match(output.text, /^The TypeScript API server could not open .+; after \d+ ms it had stopped\.\n(?:.*\n)*Checked the component and service names of 1 Angular files\.\n$/);

      const other = await RepositoryFixture.createAsync();
      t.after(() => other.disposeAsync());
      await other.writeAsync({ [file]: source, "_build": "a file where the build folder belongs\n" });
      await assert.rejects(AngularFileCheckTests.createCheck(other).runAsync(new TextOutputFixture()), { code: "ENOTDIR" });
    });
  }

  private static createCheck(repository: RepositoryFixture): AngularFileCheck {
    const directory = repository.directory;
    return new AngularFileCheck(new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), new SyntaxTreeReader(directory, [ApiServer.locateCompiler()], AngularFileCheckTests.TIMEOUT));
  }
}

AngularFileCheckTests.register();
