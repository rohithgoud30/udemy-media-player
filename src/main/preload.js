"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFileExists = void 0;
const electron_1 = require("electron");
const checkFileExists = (filePath) => {
    return electron_1.ipcRenderer.invoke("check-file-exists", filePath);
};
exports.checkFileExists = checkFileExists;
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    selectDirectory: () => {
        return electron_1.ipcRenderer.invoke("select-directory");
    },
    scanDirectory: (dirPath) => {
        return electron_1.ipcRenderer.invoke("scan-directory", dirPath);
    },
    checkFileExists: (filePath) => {
        return electron_1.ipcRenderer.invoke("check-file-exists", filePath);
    },
    getSettings: () => {
        return electron_1.ipcRenderer.invoke("get-settings");
    },
    saveSettings: (settings) => {
        return electron_1.ipcRenderer.invoke("save-settings", settings);
    },
    getSrtFilePath: (videoFilePath) => {
        const path = require("path");
        const fs = require("fs");
        const parsedPath = path.parse(videoFilePath);
        const possibleNames = [
            `${parsedPath.name}_en.srt`,
            `${parsedPath.name}.en.srt`,
            `${parsedPath.name}.srt`,
            `${parsedPath.name}.vtt`,
            `${parsedPath.name}_en.vtt`,
            `${parsedPath.name}.en.vtt`,
        ];
        for (const name of possibleNames) {
            const fullPath = path.join(parsedPath.dir, name);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
        return path.format({
            dir: parsedPath.dir,
            name: `${parsedPath.name}_en`,
            ext: ".srt",
        });
    },
    readSrtFile: async (srtFilePath) => {
        const fs = require("fs").promises;
        try {
            return await fs.readFile(srtFilePath, "utf-8");
        }
        catch {
            return null;
        }
    },
    invoke: (channel, ...args) => {
        const validChannels = [
            "select-directory",
            "scan-directory",
            "check-file-exists",
            "get-settings",
            "save-settings",
        ];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
        else {
            return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
        }
    },
});
