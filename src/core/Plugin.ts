import { Plugin } from "obsidian";
import type { ScrollingPluginSettings } from "@core/settings";
import { DEFAULT_SETTINGS } from "@core/settings";
import type { Events } from "@core/events";
import type { FeatureRegistry } from "./FeatureRegistry";

export abstract class BaseScrollingPlugin extends Plugin {
    public settings!: ScrollingPluginSettings;
    public events!: Events;
    public features!: FeatureRegistry;

    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        for (const key in this.settings) {
            if (!(key in DEFAULT_SETTINGS)) {
                delete (this.settings as any)[key];
            }
        }
    }

    public async saveSettings() {
        await this.saveData(this.settings);
        await this.features.triggerSettingsChange();
    }

    public getMainDoc(): Document {
        return this.app.workspace.containerEl.ownerDocument;
    }

    public enableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.addClass(n);
            }
        } else {
            this.getMainDoc().body.addClass(name);
        }
    }

    public disableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.removeClass(n);
            }
        } else {
            this.getMainDoc().body.removeClass(name);
        }
    }

    public setStyleProperty(key: string, value: string) {
        this.getMainDoc().body.style.setProperty(key, value);
    }

    public removeStyleProperty(key: string) {
        this.getMainDoc().body.style.removeProperty(key);
    }
}
