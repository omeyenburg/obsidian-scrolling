import { Plugin, TFile } from "obsidian";

import { FollowCursor } from "./followcursor";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    restoreScroll: RestoreScroll;
    followcursor: FollowCursor;
    mousescroll: MouseScroll;
    scrollbar: Scrollbar;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.restoreScroll = new RestoreScroll(this);
        this.followcursor = new FollowCursor(this);
        this.mousescroll = new MouseScroll(this);
        this.scrollbar = new Scrollbar(this);

        this.restoreScroll.loadData();

        this.registerEvent(
            this.app.workspace.on("active-leaf-change", this.activeLeafChangeHandler.bind(this)),
        );

        console.log("ScrollingPlugin loaded");
    }

    async activeLeafChangeHandler() {
        this.scrollbar.activeLeafChangeHandler();
        this.mousescroll.activeLeafChangeHandler();
    }

    async onunload() {
        this.scrollbar?.removeStyle();

        console.log("ScrollingPlugin unloaded");
    }

    async loadSettings() {
        const loaded = await this.loadData();
        const settings: Partial<ScrollingPluginSettings> = {};

        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ScrollingPluginSettings)[]) {
            settings[key] = loaded[key] ?? DEFAULT_SETTINGS[key];
        }

        this.settings = settings as ScrollingPluginSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
