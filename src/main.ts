import { Plugin } from "obsidian";

import { SmartScroll } from "./smartscroll";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    mousescroll: MouseScroll;
    restoreScroll: RestoreScroll;
    scrollbar: Scrollbar;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        new SmartScroll(this);
        this.mousescroll = new MouseScroll(this);
        this.restoreScroll = new RestoreScroll(this);
        this.scrollbar = new Scrollbar(this);

        this.registerEvent(
            this.app.workspace.on("quit", (tasks) => tasks.add(() => this.saveSettings())),
        );

        this.registerEvent(
            this.app.workspace.on("active-leaf-change", this.activeLeafChangeHandler.bind(this)),
        );

        console.log("ScrollingPlugin loaded");
    }

    activeLeafChangeHandler() {
        this.scrollbar.activeLeafChangeHandler();
        this.mousescroll.activeLeafChangeHandler();
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
