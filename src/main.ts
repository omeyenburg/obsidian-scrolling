import { Plugin } from "obsidian";

import { SmartScroll } from "./smartscroll";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    restoreScroll: RestoreScroll;
    scrollbar: Scrollbar;
    settings: ScrollingPluginSettings;
    quitting = false;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        new SmartScroll(this);
        new MouseScroll(this);
        this.restoreScroll = new RestoreScroll(this);
        this.scrollbar = new Scrollbar(this);

        this.registerEvent(this.app.workspace.on("quit", this.quit));
        this.registerEvent(this.app.workspace.on("window-close", this.quit));

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.scrollbar?.removeStyle();

        console.log("ScrollingPlugin unloaded");
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async quit() {
        if (this.quitting) return;
        this.quitting = true;
        await this.saveSettings();
    }
}
