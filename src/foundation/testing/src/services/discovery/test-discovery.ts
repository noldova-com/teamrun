/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing-exception.js";
import { TestDataEntry } from "../../models/decorators/test-data-entry.js";
import { TestMarks } from "../../models/decorators/test-marks.js";
import { DiscoveredTestClass } from "../../models/discovery/discovered-test-class.js";
import { DiscoveredTestMethod } from "../../models/discovery/discovered-test-method.js";
import type { TestProject } from "../../models/discovery/test-project.js";
import { Resources } from "../../resources.js";

export class TestDiscovery {
  private static readonly TEST_CLASS_SUFFIX: string = "Tests";
  private static readonly TEST_FILE_SUFFIX: string = ".test.js";

  public async discoverAsync(testProjects: readonly TestProject[]): Promise<DiscoveredTestClass[]> {
    const testClasses: DiscoveredTestClass[] = [];
    const sortedProjects = [...testProjects]
      .sort((first, second) => first.packageName.localeCompare(second.packageName) || first.rootDirectory.localeCompare(second.rootDirectory));
    for (const testProject of sortedProjects) {
      for (const testFile of await this.findTestFilesAsync(testProject.rootDirectory)) {
        const filePath = relative(testProject.rootDirectory, testFile).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator);
        testClasses.push(...this.discoverModuleExports(await import(pathToFileURL(testFile).href), filePath, testProject.packageName));
      }
    }

    return testClasses;
  }

  public discoverModuleExports(moduleExports: object, filePath: string, packageName: string): DiscoveredTestClass[] {
    ArgumentException.throwIfNullOrWhitespace(filePath, "filePath");
    ArgumentException.throwIfNullOrWhitespace(packageName, "packageName");

    const testClasses: DiscoveredTestClass[] = [];
    for (const exportName of Object.keys(moduleExports).sort()) {
      const exportedValue = this.getOwnDataProperty(moduleExports, exportName);
      const isNamed = exportName.endsWith(TestDiscovery.TEST_CLASS_SUFFIX);

      if (!this.isMarkedTestClass(exportedValue)) {
        if (this.hasCategories(exportedValue))
          throw new TestingException(Resources.categoryWithoutTestClass(exportName, filePath));

        if (isNamed)
          throw new TestingException(Resources.unmarkedNamedTestClass(exportName, filePath));

        continue;
      }

      if (!isNamed)
        throw new TestingException(Resources.markedTestClassWithoutRequiredName(exportName, filePath, TestDiscovery.TEST_CLASS_SUFFIX));

      testClasses.push(this.discoverTestClass(exportName, exportedValue, filePath, packageName));
    }

    if (testClasses.length === 0)
      throw new TestingException(Resources.testFileWithoutTestClass(filePath));

    return testClasses;
  }

  private discoverTestClass(className: string, testClassConstructor: new () => object, filePath: string, packageName: string): DiscoveredTestClass {
    const prototype: unknown = testClassConstructor.prototype;
    if (typeof prototype !== "object" || Object.isNull(prototype))
      throw new TestingException(Resources.testClassWithoutPrototype(className, filePath));
    const classCategories = this.getCategories(testClassConstructor);

    const staticDescriptors = Object.entries(Object.getOwnPropertyDescriptors(testClassConstructor))
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName));
    for (const [memberName, descriptor] of staticDescriptors) {
      if (memberName === "length" || memberName === "name" || memberName === "prototype")
        continue;

      if (this.descriptorHasTestMetadata(descriptor))
        throw new TestingException(Resources.staticTestMetadataInvalid(memberName, className, filePath));
    }

    const methods: DiscoveredTestMethod[] = [];
    const instanceDescriptors = Object.entries(Object.getOwnPropertyDescriptors(prototype))
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName));
    for (const [memberName, descriptor] of instanceDescriptors) {
      if (memberName === "constructor")
        continue;

      if (!Object.isUndefined(descriptor.get) || !Object.isUndefined(descriptor.set)) {
        if (this.descriptorHasTestMetadata(descriptor))
          throw new TestingException(Resources.accessorTestMetadataInvalid(memberName, className, filePath));

        continue;
      }

      const member = this.getOwnDataProperty(prototype, memberName);
      const testDataEntries = this.getTestDataEntries(member);
      const methodCategories = this.getCategories(member);
      if (!this.isMarkedTestMethod(member)) {
        if (!Object.isUndefined(testDataEntries))
          throw new TestingException(Resources.testDataWithoutTestMethod(memberName, className, filePath));
        if (methodCategories.length > 0)
          throw new TestingException(Resources.categoryWithoutTestMethod(memberName, className, filePath));

        continue;
      }

      const skipReason = this.getSkipReason(member);
      const categories = [...classCategories, ...methodCategories];
      if (Object.isUndefined(testDataEntries)) {
        if (member.length > 0)
          throw new TestingException(Resources.testMethodRequiresData(memberName, className, filePath));

        methods.push(new DiscoveredTestMethod(memberName, undefined, [], skipReason, categories));
        continue;
      }

      for (let index = 0; index < testDataEntries.length; index++) {
        const testDataEntry = testDataEntries[index];
        if (Object.isUndefined(testDataEntry))
          throw new TestingException(Resources.testDataMarkInvalid);

        if (testDataEntry.values.length !== member.length)
          throw new TestingException(Resources.testDataParameterCountMismatch(
            memberName,
            className,
            filePath,
            member.length,
            testDataEntry.values.length));

        methods.push(new DiscoveredTestMethod(memberName, index, testDataEntry.values, skipReason, categories));
      }
    }

    if (methods.length === 0)
      throw new TestingException(Resources.testClassWithoutTestMethod(className, filePath));

    return new DiscoveredTestClass(packageName, className, filePath, testClassConstructor, this.getSkipReason(testClassConstructor), methods, classCategories);
  }

  private async findTestFilesAsync(rootDirectory: string): Promise<string[]> {
    ArgumentException.throwIfNullOrWhitespace(rootDirectory, "rootDirectory");

    const entries = await readdir(rootDirectory, { recursive: true, withFileTypes: true });
    const testFiles: string[] = [];
    for (const entry of entries)
      if (entry.isFile() && entry.name.endsWith(TestDiscovery.TEST_FILE_SUFFIX))
        testFiles.push(join(entry.parentPath, entry.name));

    return testFiles.sort();
  }

  private isMarkedTestClass(value: unknown): value is new () => object {
    return typeof value === "function" && Object.hasOwn(value, TestMarks.TEST_CLASS);
  }

  private isMarkedTestMethod(value: unknown): value is Function {
    return typeof value === "function" && Object.hasOwn(value, TestMarks.TEST_METHOD);
  }

  private hasTestData(value: unknown): value is Function {
    return typeof value === "function" && Object.hasOwn(value, TestMarks.TEST_DATA);
  }

  private hasCategories(value: unknown): value is Function {
    return typeof value === "function" && Object.hasOwn(value, TestMarks.CATEGORY);
  }

  private getCategories(value: unknown): string[] {
    if (!this.hasCategories(value))
      return [];

    const markedCategories = this.getOwnDataProperty(value, TestMarks.CATEGORY);
    if (!Array.isArray(markedCategories) || markedCategories.length === 0)
      throw new TestingException(Resources.categoryMarkInvalid);

    const categories: string[] = [];
    for (const category of markedCategories) {
      if (typeof category !== "string" || String.isNullOrWhitespace(category))
        throw new TestingException(Resources.categoryMarkInvalid);

      categories.push(category);
    }

    return [...new Set(categories)];
  }

  private getTestDataEntries(value: unknown): readonly TestDataEntry[] | undefined {
    if (!this.hasTestData(value))
      return undefined;

    const entries = this.getOwnDataProperty(value, TestMarks.TEST_DATA);
    if (!Array.isArray(entries) || entries.length === 0 || entries.some(t => !(t instanceof TestDataEntry)))
      throw new TestingException(Resources.testDataMarkInvalid);

    return entries;
  }

  private getSkipReason(value: Function): string | undefined {
    if (!Object.hasOwn(value, TestMarks.SKIP))
      return undefined;

    const reason = this.getOwnDataProperty(value, TestMarks.SKIP);
    if (typeof reason !== "string" || String.isNullOrWhitespace(reason))
      throw new TestingException(Resources.skipReasonInvalid);

    return reason;
  }

  private descriptorHasTestMetadata(descriptor: PropertyDescriptor): boolean {
    return this.hasTestMetadata(descriptor.value)
      || this.hasTestMetadata(descriptor.get)
      || this.hasTestMetadata(descriptor.set);
  }

  private hasTestMetadata(value: unknown): boolean {
    return typeof value === "function"
      && (this.isMarkedTestMethod(value) || this.hasTestData(value) || this.hasCategories(value) || Object.hasOwn(value, TestMarks.SKIP));
  }

  private getOwnDataProperty(value: object, propertyKey: PropertyKey): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);

    return !Object.isUndefined(descriptor) && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  }
}
