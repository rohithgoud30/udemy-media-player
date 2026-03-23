#!/usr/bin/env node

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { stat } = require("fs/promises");

const isDev = process.env.NODE_ENV === "development";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
  } else {
    const indexPath = path.join(__dirname, "../../dist/index.html");
    mainWindow.loadFile(indexPath);
  }

  // Handle external links - open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
      if (!url.startsWith(devServerUrl)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Handle directory selection
  ipcMain.handle("select-directory", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error("Error in directory selection:", error);
      return null;
    }
  });

  // Handle directory scanning
  ipcMain.handle("scan-directory", async (event, dirPath) => {
    try {
      const files = [];
      const scanDir = (dir) => {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          try {
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
              scanDir(fullPath);
            } else {
              files.push({
                name: entry,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime,
              });
            }
          } catch (err) {
            // Skip inaccessible files
          }
        }
      };

      scanDir(dirPath);
      return { files, basePath: dirPath };
    } catch (error) {
      console.error("Error scanning directory:", error);
      return { files: [], basePath: dirPath };
    }
  });

  // Handle file existence check
  ipcMain.handle("check-file-exists", (event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  });

  // Settings storage
  const settingsPath = path.join(app.getPath("userData"), "settings.json");

  ipcMain.handle("get-settings", () => {
    try {
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, "utf8");
        return JSON.parse(settingsData);
      }
      return {};
    } catch (error) {
      console.error("Error reading settings:", error);
      return {};
    }
  });

  ipcMain.handle("save-settings", (event, settings) => {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});
