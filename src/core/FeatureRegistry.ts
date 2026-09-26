import type { Feature } from "@core/Feature";
import { features } from "@core/feature.schema";
import { SettingsFactory } from "@core/SettingsFactory";
import { SettingDefinitionItem } from "obsidian";
import ScrollingPlugin from "@core/main";

export class FeatureRegistry {
    private readonly features: Feature[];
    private readonly settingsFactory: SettingsFactory;

    constructor(private readonly plugin: ScrollingPlugin) {
        this.features = features.map((Constructor) => new Constructor());
        this.settingsFactory = new SettingsFactory(plugin);
    }

    public get<T extends Feature>(id: string): T | undefined {
        return this.features.find((f) => f.id === id) as T | undefined;
    }

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
}
