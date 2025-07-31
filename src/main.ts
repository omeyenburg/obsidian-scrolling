import { Plugin } from "obsidian";

import { Events } from "./events";
import { FollowCursor } from "./followcursor";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { LineWidth } from "./linewidth";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    restoreScroll!: RestoreScroll;
    followcursor!: FollowCursor;
    mousescroll!: MouseScroll;
    scrollbar!: Scrollbar;
    linewidth!: LineWidth;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.restoreScroll = new RestoreScroll(this);
        this.followcursor = new FollowCursor(this);
        this.mousescroll = new MouseScroll(this);
        this.scrollbar = new Scrollbar(this);
        this.linewidth = new LineWidth(this);

        new Events(this);

        await this.restoreScroll.loadData();

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.scrollbar?.removeStyle();
        this.restoreScroll.quitHandler();

        console.log("ScrollingPlugin unloaded");
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
}
