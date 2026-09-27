import { Plugin } from "obsidian";

import { Events } from "@core/events";
import { FeatureRegistry } from "@core/FeatureRegistry";
import { ScrollingSettingTab } from "@core/ScrollingSettingTab";
import { ScrollingPluginSettings } from "@core/feature.schema";
import type { SettingsStore } from "@core/SettingsStore";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    events!: Events;
    featureRegistry!: FeatureRegistry;
    settingsStore!: SettingsStore;

    async onload() {
        this.featureRegistry = new FeatureRegistry(this);
        this.settingsStore = this.featureRegistry.store;

        await this.loadSettings();

        this.events = new Events(this);

        await this.featureRegistry.loadAll();

        const settingTab = new ScrollingSettingTab(this, this.featureRegistry, this.settingsStore);
        this.settingsStore.attachTab(settingTab);
        this.addSettingTab(settingTab);

        this.events.postInit();
    }

    onunload() {
        this.featureRegistry.unloadAll();
    }

    async loadSettings() {
        const defaultSettings = this.featureRegistry.store.buildDefaults();
        const stored = (await this.loadData()) ?? {};
        this.settings = Object.assign({}, defaultSettings, stored);

        // Drop keys no longer declared by any feature.
        const known = this.settings as Record<string, unknown>;
        for (const key of Object.keys(known)) {
            if (!(key in defaultSettings)) {
                delete known[key];
            }
        }
    }

    getMainDoc(): Document {
        return this.app.workspace.containerEl.ownerDocument;
    }

    enableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.addClass(n);
            }
        } else {
            this.getMainDoc().body.addClass(name);
        }
    }

    disableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.removeClass(n);
            }
        } else {
            this.getMainDoc().body.removeClass(name);
        }
    }

    setStyleProperty(key: string, value: string) {
        this.getMainDoc().body.style.setProperty(key, value);
    }

    removeStyleProperty(key: string) {
        this.getMainDoc().body.style.removeProperty(key);
    }
}
