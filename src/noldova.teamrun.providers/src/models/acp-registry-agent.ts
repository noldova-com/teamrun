/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";

import { AcpRegistryException } from "../exceptions/acp-registry.exception.js";
import { Resources } from "../resources.js";
import { AcpRegistryBinary } from "./acp-registry-binary.js";
import { AcpRegistryPackage } from "./acp-registry-package.js";

export class AcpRegistryAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly description: string;
  public readonly icon: string | null;
  public readonly binaries: ReadonlyMap<string, AcpRegistryBinary>;
  public readonly npx: AcpRegistryPackage | null;
  public readonly uvx: AcpRegistryPackage | null;
  public readonly about: string | null;

  public constructor(id: string, name: string, version: string, description: string, icon: string | null, binaries: ReadonlyMap<string, AcpRegistryBinary>,
    npx: AcpRegistryPackage | null, uvx: AcpRegistryPackage | null, about: string | null = null) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.description = description;
    this.icon = icon;
    this.binaries = new Map(binaries);
    this.npx = npx;
    this.uvx = uvx;
    this.about = about;
  }

  public static fromJson(reader: JsonReader): AcpRegistryAgent {
    const id = reader.readNonBlankString(Resources.idField);
    if (!AcpRegistryAgent.isUsableId(id) || id.startsWith(Resources.localAcpKindPrefix) || Resources.acpRegistryDeviceNames.test(id))
      throw new AcpRegistryException(Resources.formatAcpRegistryIdInvalid(id));
    if (Resources.acpRegistryOwnProviderIds.includes(id))
      throw new AcpRegistryException(Resources.formatAcpRegistryOwnProvider(id));
    const version = reader.readNonBlankString(Resources.acpRegistryVersionField);
    if (!Resources.releaseVersionPattern.test(version))
      throw new AcpRegistryException(Resources.formatAcpRegistryVersionInvalid(id, version));
    const icon = reader.readOptionalString(Resources.acpRegistryIconField) ?? null;
    const distribution = reader.readObject(Resources.acpRegistryDistributionField);
    const binary = distribution.hasField(Resources.acpRegistryBinaryField) ? distribution.readObject(Resources.acpRegistryBinaryField) : null;
    const targets = Object.keys(binary?.toJson() ?? {}).filter(t => Resources.acpRegistryTargets.includes(t));
    const npx = distribution.hasField(Resources.acpRegistryNpxField) ? AcpRegistryPackage.fromJson(distribution.readObject(Resources.acpRegistryNpxField)) : null;
    const uvx = distribution.hasField(Resources.acpRegistryUvxField) ? AcpRegistryPackage.fromJson(distribution.readObject(Resources.acpRegistryUvxField)) : null;
    return new AcpRegistryAgent(id, reader.readNonBlankString(Resources.nameField), version, reader.readOptionalString(Resources.descriptionField) ?? String.empty,
      !Object.isNull(icon) && Resources.acpRegistryArchivePattern.test(icon) ? icon : null,
      new Map(targets.map(t => [t, AcpRegistryBinary.fromJson(binary!.readObject(t))])), npx, uvx, AcpRegistryAgent.aboutOf(reader));
  }

  public static isUsableId(id: string): boolean {
    return id.length <= Resources.acpRegistryIdMaxLength && Resources.acpRegistryIdPattern.test(id);
  }

  public static targetOf(platform: NodeJS.Platform, arch: string): string | null {
    const system = Resources.acpRegistrySystems[platform];
    const machine = Resources.acpRegistryMachines[arch];
    return Object.isUndefined(system) || Object.isUndefined(machine) ? null : `${system}-${machine}`;
  }

  public binaryFor(target: string | null): AcpRegistryBinary | null {
    return Object.isNull(target) ? null : this.binaries.get(target) ?? null;
  }

  public isListedFor(target: string | null): boolean {
    return !Object.isNull(this.binaryFor(target)) || !Object.isNull(this.npx) || !Object.isNull(this.uvx);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.nameField]: this.name, [Resources.acpRegistryVersionField]: this.version, [Resources.descriptionField]: this.description,
      ...Object.isNull(this.icon) ? {} : { [Resources.acpRegistryIconField]: this.icon }, ...Object.isNull(this.about) ? {} : { [Resources.acpRegistryWebsiteField]: this.about },
      [Resources.acpRegistryDistributionField]: {
        ...this.binaries.size === 0 ? {} : { [Resources.acpRegistryBinaryField]: Object.fromEntries([...this.binaries].map(([target, binary]) => [target, binary.toJson()])) },
        ...Object.isNull(this.npx) ? {} : { [Resources.acpRegistryNpxField]: this.npx.toJson() },
        ...Object.isNull(this.uvx) ? {} : { [Resources.acpRegistryUvxField]: this.uvx.toJson() }
      } };
  }

  private static aboutOf(reader: JsonReader): string | null {
    return [Resources.acpRegistryWebsiteField, Resources.acpRegistryRepositoryField].map(t => reader.readOptionalString(t) ?? String.empty)
      .find(t => Resources.acpRegistryArchivePattern.test(t)) ?? null;
  }
}
