import { Plugin } from "obsidian";

import { CenterCursorFeature } from "@features/CenterCursorFeature";
import { CodeBlockFeature } from "@features/CodeBlockFeature";
import { CommandsFeature } from "@features/CommandsFeature";
import { FileTreeFeature } from "@features/FileTreeFeature";
import { LineLengthFeature } from "@features/LineLengthFeature";
import { MathJaxFeature } from "@features/MathJaxFeature";
import { MouseScrollFeature } from "@features/MouseScrollFeature";
import { PreviewScrollKeysFeature } from "@features/PreviewScrollKeysFeature";
import { RememberFileStateFeature } from "@features/RememberFileStateFeature";
import { ScrollButtonsFeature } from "@features/ScrollButtonsFeature";
import { ScrollbarFeature } from "@features/ScrollbarFeature";

import { Events } from "@core/events";
import { FeatureRegistry } from "@core/FeatureRegistry";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "@core/settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    events!: Events;
    featureRegistery!: FeatureRegistry;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.events = new Events(this);
        this.featureRegistery = new FeatureRegistry(this);

        this.featureRegistery.register(new CenterCursorFeature());
        this.featureRegistery.register(new CodeBlockFeature());
        this.featureRegistery.register(new CommandsFeature());
        this.featureRegistery.register(new FileTreeFeature());
        this.featureRegistery.register(new LineLengthFeature());
        this.featureRegistery.register(new MathJaxFeature());
        this.featureRegistery.register(new MouseScrollFeature());
        this.featureRegistery.register(new PreviewScrollKeysFeature());
        this.featureRegistery.register(new RememberFileStateFeature());
        this.featureRegistery.register(new ScrollButtonsFeature());
        this.featureRegistery.register(new ScrollbarFeature());

        await this.featureRegistery.loadAll();

        this.events.postInit();

        // await this.restoreScroll.loadStatesFile(); // TODO: must be done
    }

    onunload() {
        this.events.unload();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        for (const key in this.settings) {
            if (!(key in DEFAULT_SETTINGS)) {
                delete this.settings[key];
            }
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
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
