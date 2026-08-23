import type { Feature } from "@core/Feature";
import type { default as ScrollingPlugin } from "@core/main";
import { features } from "@core/feature.schema";
import { SettingsFactory } from "@core/SettingsFactory";
import { SettingDefinitionItem } from "obsidian";

export class FeatureRegistry {
    private readonly features: Feature[];
    private readonly settingsFactory: SettingsFactory;

    constructor(private readonly plugin: ScrollingPlugin) {
        this.features = features.map((Constructor) => new Constructor());
        this.settingsFactory = new SettingsFactory(plugin);
    }

    // public register(feature: Feature): void {
    //     this.features.set(feature.id, feature);
    // }

    // public get<T extends Feature>(id: string): T | undefined {
    //     return this.features.get(id) as T | undefined;
    // }

    public getSettingDefinitions(): SettingDefinitionItem[] {
        return this.settingsFactory.getSettingDefinitions(this.features);
    }

    public getDefaultSettings() {
        return this.settingsFactory.getDefaultSettings(this.features);
    }

    public async loadAll(): Promise<void> {
        for (const feature of this.features.values()) {
            try {
                await feature.onload(this.plugin);
                console.log(feature.id);
            } catch (err) {
                console.error(`Failed to load feature "${feature.id}":`, err);
            }
        }
    }

    public unloadAll(): void {
        for (const feature of this.features.values()) {
            try {
                feature.onunload();
            } catch (err) {
                console.error(`Failed to unload feature "${feature.id}":`, err);
            }
        }
        // this.features.clear();
    }

    public async triggerSettingsChange(): Promise<void> {
        const settings = this.plugin.settings;
        for (const feature of this.features.values()) {
            if (feature.onSettingsChange) {
                try {
                    await feature.onSettingsChange(settings);
                } catch (err) {
                    console.error(`Error in onSettingsChange for feature "${feature.id}":`, err);
                }
            }
        }
    }
}
