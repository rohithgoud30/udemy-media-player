#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const isDev = process.env.NODE_ENV === "development";
const iconPath = path_1.default.join(__dirname, "../../build/icon.png");
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: iconPath,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: process.env.NODE_ENV !== "development",
            allowRunningInsecureContent: process.env.NODE_ENV === "development",
        },
    });
    if (isDev) {
        const serverUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
        mainWindow.loadURL(serverUrl);
        mainWindow.webContents.openDevTools();
    }
    else {
        const indexPath = path_1.default.join(__dirname, "../../dist/index.html");
        mainWindow.loadFile(indexPath);
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            electron_1.shell.openExternal(url);
            return { action: "deny" };
        }
        return { action: "allow" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
            if (!url.startsWith(devServerUrl)) {
                event.preventDefault();
                electron_1.shell.openExternal(url);
            }
        }
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function setupIpcHandlers() {
    electron_1.ipcMain.handle("select-directory", async () => {
        try {
            const result = await electron_1.dialog.showOpenDialog({
                properties: ["openDirectory"],
            });
            return result.canceled ? null : result.filePaths[0];
        }
        catch (error) {
            console.error("Error in directory selection:", error);
            return null;
        }
    });
    electron_1.ipcMain.handle("scan-directory", async (_event, dirPath) => {
        try {
            const files = [];
            const scanDir = (dir) => {
                const entries = fs_1.default.readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = path_1.default.join(dir, entry);
                    try {
                        const stats = fs_1.default.statSync(fullPath);
                        if (stats.isDirectory()) {
                            scanDir(fullPath);
                        }
                        else {
                            files.push({
                                name: entry,
                                path: fullPath,
                                size: stats.size,
                                mtime: stats.mtime,
                            });
                        }
                    }
                    catch {
                        // Skip inaccessible files
                    }
                }
            };
            scanDir(dirPath);
            return { files, basePath: dirPath };
        }
        catch (error) {
            console.error("Error scanning directory:", error);
            return { files: [], basePath: dirPath };
        }
    });
    electron_1.ipcMain.handle("check-file-exists", (_event, filePath) => {
        try {
            return fs_1.default.existsSync(filePath);
        }
        catch {
            return false;
        }
    });
    const settingsPath = path_1.default.join(electron_1.app.getPath("userData"), "settings.json");
    electron_1.ipcMain.handle("get-settings", () => {
        try {
            if (fs_1.default.existsSync(settingsPath)) {
                const settingsData = fs_1.default.readFileSync(settingsPath, "utf8");
                return JSON.parse(settingsData);
            }
            return {};
        }
        catch (error) {
            console.error("Error reading settings:", error);
            return {};
        }
    });
    electron_1.ipcMain.handle("save-settings", (_event, settings) => {
        try {
            fs_1.default.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            return true;
        }
        catch (error) {
            console.error("Error saving settings:", error);
            return false;
        }
    });
}
electron_1.app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});
