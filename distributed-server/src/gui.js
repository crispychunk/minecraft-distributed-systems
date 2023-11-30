const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");

let mainWindow;

function getLocalIPv4Address() {
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];

    for (const iface of interfaceInfo) {
      // Check for IPv4 and exclude loopback and internal addresses
      if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal && iface.address !== "127.0.0.1") {
        return iface.address;
      }
    }
  }

  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
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

// Internal logic
let info;
let nodeList;
async function getInfo() {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/info`;
  const result = await axios.get(URL);
  info = result.data.info;
  nodeList = info.network;
  mainWindow.webContents.send("update-node-list", nodeList);
}

setInterval(getInfo, 1000);

// Call Distributed Server for information

// Listen for the 'join-network' message from the renderer process
ipcMain.on("join-network", async (nodeAddress) => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/request-network`;
  const body = {
    address: `http://${nodeAddress}:${8080}`,
  };

  try {
    await axios.put(URL, body);
    mainWindow.webContents.send("join-success");
  } catch {
    mainWindow.webContents.send("join-error");
  }
  // Send an update to the renderer process with the updated node list
  mainWindow.webContents.send("update-node-list", nodeList);
});

ipcMain.on("create-network", async () => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/create-network`;

  try {
    const result = await axios.post(URL, null, {
      headers: {
        "Content-Type": "application/json", // Set the appropriate content type
      },
    });
    mainWindow.webContents.send("create-success");
  } catch (error) {
    console.log(error);
    mainWindow.webContents.send("error");
  }
});
ipcMain.handle("get-info", () => {
  return { info, nodeList };
});

// Listen for the 'leave-network' message from the renderer process
ipcMain.on("leave-network", async () => {
  const address = getLocalIPv4Address();
  const port = 8080;
  const URL = `http://${address}:${port}/request-leave-network`;

  try {
    await axios.delete(URL);
    mainWindow.webContents.send("leave-success");
  } catch (error) {
    console.log(error);
    mainWindow.webContents.send("leave-error");
  }
});
