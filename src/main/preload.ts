import { contextBridge, ipcRenderer } from "electron";

interface ScannedFile {
  name: string;
  path: string;
  size: number;
  mtime: Date;
}

interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (dirPath: string) => Promise<{ files: ScannedFile[]; basePath: string }>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;
  getSrtFilePath: (videoFilePath: string) => string;
  readSrtFile: (srtFilePath: string) => Promise<string | null>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

export const checkFileExists = (filePath: string): Promise<boolean> => {
  return ipcRenderer.invoke("check-file-exists", filePath);
};

contextBridge.exposeInMainWorld("electronAPI", {
  selectDirectory: () => {
    return ipcRenderer.invoke("select-directory");
  },

  scanDirectory: (dirPath: string) => {
    return ipcRenderer.invoke("scan-directory", dirPath);
  },

  checkFileExists: (filePath: string) => {
    return ipcRenderer.invoke("check-file-exists", filePath);
  },

  getSettings: () => {
    return ipcRenderer.invoke("get-settings");
  },

  saveSettings: (settings: Record<string, unknown>) => {
    return ipcRenderer.invoke("save-settings", settings);
  },

  getSrtFilePath: (videoFilePath: string) => {
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

  readSrtFile: async (srtFilePath: string) => {
    const fs = require("fs").promises;
    try {
      return await fs.readFile(srtFilePath, "utf-8");
    } catch {
      return null;
    }
  },

  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = [
      "select-directory",
      "scan-directory",
      "check-file-exists",
      "get-settings",
      "save-settings",
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    } else {
      return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
    }
  },
} as ElectronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
