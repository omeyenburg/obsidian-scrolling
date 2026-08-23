import { Plugin } from "obsidian";

import { Events } from "@core/events";
import { FeatureRegistry } from "@core/FeatureRegistry";
import { ScrollingSettingTab } from "@core/ScrollingSettingTab";
import { ScrollingPluginSettings } from "@core/feature.schema";
import { RememberFileStateFeature } from "@features/RememberFileStateFeature";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    events!: Events;
    featureRegistery!: FeatureRegistry;

    async onload() {
        this.featureRegistery = new FeatureRegistry(this);

        await this.loadSettings();

        this.events = new Events(this);

        await this.featureRegistery.loadAll();

        this.addSettingTab(new ScrollingSettingTab(this, this.featureRegistery));

        this.events.postInit();

        const rememberFileState = this.featureRegistery.get<RememberFileStateFeature>("rememberFileState");
        if (rememberFileState && this.settings.restoreScrollFileEnabled) {
            await rememberFileState.loadStatesFile();
        }
    }

    onunload() {
        this.featureRegistery.unloadAll();
        this.events.unload();
    }

    async loadSettings() {
        const defaultSettings = this.featureRegistery.getDefaultSettings();
        console.log(defaultSettings)
        this.settings = Object.assign({}, defaultSettings, await this.loadData());

        for (const key in this.settings) {
            if (!(key in defaultSettings)) {
                delete (this.settings as any)[key];
            }
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        await this.featureRegistery.triggerSettingsChange();
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
