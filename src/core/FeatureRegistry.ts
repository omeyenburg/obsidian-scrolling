import type { SettingDefinitionItem } from "obsidian";

import type { Feature, ScrollingPlugin } from "@core/Feature";
import { features } from "@core/feature.schema";
import { SettingsStore } from "@core/SettingsStore";
import { SettingsTranslator } from "@core/SettingsTranslator";

type AnyFeature = InstanceType<(typeof features)[number]>;

export class FeatureRegistry {
    private readonly features: readonly AnyFeature[];
    private readonly settingsStore: SettingsStore;
    private readonly translator: SettingsTranslator;

    constructor(private readonly plugin: ScrollingPlugin) {
        this.features = features.map((Constructor) => new Constructor());
        this.settingsStore = new SettingsStore(plugin);
        this.translator = new SettingsTranslator(this.settingsStore);

        // Must happen before the features load: defaults and `onChange` handlers are
        // derived from the definitions, and `onload` may read settings.
        for (const feature of this.features) {
            this.settingsStore.register(feature);
        }
    }

    get store(): SettingsStore {
        return this.settingsStore;
    }

    /** The feature declaring `id`, narrowed to that feature's own type. */
    get<K extends AnyFeature["id"]>(id: K): Extract<AnyFeature, { id: K }> | undefined {
        return this.features.find((feature) => feature.id === id) as
            | Extract<AnyFeature, { id: K }>
            | undefined;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return this.translator.getSettingDefinitions(this.features as readonly Feature[]);
    }

    async loadAll(): Promise<void> {
        for (const feature of this.features) {
            try {
                // `onload` may be sync or async, but the sequence must wait either
                // way, so normalise it into a real promise first.
                await Promise.resolve(feature.onload(this.plugin));
            } catch (err) {
                console.error(`Failed to load feature "${feature.id}":`, err);
            }
        }
    }

    unloadAll(): void {
        for (const feature of this.features) {
            try {
                feature.onunload();
            } catch (err) {
                console.error(`Failed to unload feature "${feature.id}":`, err);
            }
        }
    }
}
