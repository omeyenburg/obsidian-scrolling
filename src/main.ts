import { Plugin } from "obsidian";
import { SmartScroll } from "./smartscroll";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    scrollbar: Scrollbar;
    settings: ScrollingPluginSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        new SmartScroll(this);
        new MouseScroll(this);
        this.scrollbar = new Scrollbar(this);

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
}
