const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // Set to false to use preload script
      preload: path.join(__dirname, "gui/renderer.js"),
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Call Distributed Server for information

const info = await axios.get();
let nodeList = [];

// Listen for the 'join-network' message from the renderer process
ipcMain.on("join-network", () => {
  // Handle logic for joining the network
  // For example, add the current node to the nodeList
  nodeList.push("New Node");

  // Send an update to the renderer process with the updated node list
  mainWindow.webContents.send("update-node-list", nodeList);
});

// Listen for the 'leave-network' message from the renderer process
ipcMain.on("leave-network", () => {
  // Handle logic for leaving the network
  // For example, remove the current node from the nodeList
  nodeList.pop();

  // Send an update to the renderer process with the updated node list
  mainWindow.webContents.send("update-node-list", nodeList);
});
