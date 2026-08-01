import { Notice, normalizePath } from "obsidian";
import type { default as ScrollingPlugin } from "@core/main";

export interface PerFileState {
    timestamp: number;
    scroll?: number;
    scrollTop?: number;
    cursor?: any; // EditorRange
}

export class PerFileStateStore {
    private readonly plugin: ScrollingPlugin;
    private ephemeralStates: Record<string, PerFileState> = {};

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    public getStates(): Record<string, PerFileState> {
        return this.ephemeralStates;
    }

    public getState(fileId: string): PerFileState | undefined {
        return this.ephemeralStates[fileId];
    }

    public setState(fileId: string, state: Omit<PerFileState, "timestamp">): void {
        this.ephemeralStates[fileId] = {
            ...state,
            timestamp: Date.now(),
        };

        if (this.plugin.settings.restoreScrollAge) {
            this.discardNewStates();
        } else {
            this.discardOldStates();
        }
    }

    public deleteState(filePath: string): void {
        delete this.ephemeralStates[filePath];
    }

    public renameState(oldPath: string, newPath: string): void {
        if (this.ephemeralStates[oldPath]) {
            this.ephemeralStates[newPath] = this.ephemeralStates[oldPath];
            delete this.ephemeralStates[oldPath];
        }
    }

    public getNumStates(): number {
        return Object.keys(this.ephemeralStates).length;
    }

    public getDefaultStateFilePath(): string {
        return this.plugin.manifest.dir + "/scrolling-positions.json";
    }

    public async loadStatesFile(): Promise<void> {
        const exists = await this.checkStatesFileLoadPath();
        if (!exists) return;
        const filePath = this.plugin.settings.restoreScrollFilePath;

        try {
            const data = await this.plugin.app.vault.adapter.read(filePath);
            if (data) {
                this.ephemeralStates = JSON.parse(data);
            } else {
                this.ephemeralStates = {};
            }
        } catch (error) {
            console.error("Failed to load scroll positions file:", error);
            this.ephemeralStates = {};
        }
    }

    public async renameStatesFile(newPath: string | null): Promise<string | undefined> {
        if (!this.plugin.settings.restoreScrollFileEnabled) return;

        if (newPath === null) {
            new Notice("Path unchanged.");
            return;
        }

        if (!newPath || newPath.trim() === "" || newPath === "." || newPath === "..") {
            new Notice("Invalid file path!");
            return;
        }

        const newNormalizedPath = normalizePath(newPath);
        const oldNormalizedPath = normalizePath(this.plugin.settings.restoreScrollFilePath);

        if (!newNormalizedPath) {
            new Notice("Invalid file path!");
            return;
        }

        const adapter = this.plugin.app.vault.adapter;

        if (!(await this.directoryOfFileExists(newNormalizedPath))) {
            new Notice(`Directory of file does not exist.`);
            return;
        }

        if (await adapter.exists(newNormalizedPath)) {
            new Notice(`File already exists: ${newNormalizedPath}`);
            return;
        }

        if (oldNormalizedPath && (await adapter.exists(oldNormalizedPath))) {
            try {
                await adapter.rename(oldNormalizedPath, newNormalizedPath);
            } catch {
                new Notice("Invalid file path!");
                return;
            }
        }

        new Notice(`Renamed storage file to: ${newNormalizedPath}`);
        return newNormalizedPath;
    }

    public async writeStatesFile(): Promise<void> {
        if (!this.plugin.settings.restoreScrollFileEnabled) return;

        await this.checkStatesFileWritePath();
        const filePath = this.plugin.settings.restoreScrollFilePath;

        try {
            const data = JSON.stringify(this.ephemeralStates);
            await this.plugin.app.vault.adapter.write(filePath, data);
        } catch (error) {
            new Notice("Failed to write scroll positions file. Disabling disk storage.");
            console.error("Failed to write scroll positions file:", error);
            this.plugin.settings.restoreScrollFileEnabled = false;
        }
    }

    private async directoryOfFileExists(filePath: string): Promise<boolean> {
        const lastSlashIndex = filePath.lastIndexOf("/");
        if (lastSlashIndex === -1) {
            return true;
        }
        const dirPath = filePath.substring(0, lastSlashIndex);
        return await this.plugin.app.vault.adapter.exists(dirPath);
    }

    private async checkStatesFileWritePath(): Promise<void> {
        if (await this.directoryOfFileExists(this.plugin.settings.restoreScrollFilePath)) return;

        let default_path = this.getDefaultStateFilePath();
        if (await this.directoryOfFileExists(default_path)) {
            this.plugin.settings.restoreScrollFilePath = default_path;
            return;
        }
    }

    private async checkStatesFileLoadPath(): Promise<boolean> {
        if (await this.plugin.app.vault.adapter.exists(this.plugin.settings.restoreScrollFilePath))
            return true;

        let default_path = this.getDefaultStateFilePath();
        if (await this.directoryOfFileExists(default_path)) {
            this.plugin.settings.restoreScrollFilePath = default_path;
            return true;
        }

        return false;
    }

    private discardOldStates() {
        const entries = Object.entries(this.ephemeralStates);
        if (
            this.plugin.settings.restoreScrollLimit <= 0 ||
            entries.length <= this.plugin.settings.restoreScrollLimit
        )
            return;

        entries.sort(([, a], [, b]) => b.timestamp - a.timestamp);

        this.ephemeralStates = Object.fromEntries(
            entries.slice(0, this.plugin.settings.restoreScrollLimit),
        );
    }

    private discardNewStates() {
        const entries = Object.entries(this.ephemeralStates);
        const limit = this.plugin.settings.restoreScrollLimit;

        if (limit <= 0 || entries.length <= limit) return;

        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

        const oldestStates = entries.slice(0, limit);
        const newestStates = entries.slice(limit);

        const statesToKeep = new Map(oldestStates);
        for (const [fileTitle, state] of newestStates) {
            if (statesToKeep.has(fileTitle)) statesToKeep.set(fileTitle, state);
        }

        this.ephemeralStates = Object.fromEntries(statesToKeep.entries());
    }
}
