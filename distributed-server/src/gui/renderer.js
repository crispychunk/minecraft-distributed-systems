const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
  const joinNetworkBtn = document.getElementById("joinNetworkBtn");
  const leaveNetworkBtn = document.getElementById("leaveNetworkBtn");
  const nodeNameInput = document.getElementById("nodeName");
  const nodeList = document.getElementById("nodeList");

  joinNetworkBtn.addEventListener("click", () => {
    const nodeName = nodeNameInput.value.trim();
    if (nodeName) {
      // Send a message to the main process to handle "Join Network" logic
      ipcRenderer.send("join-network", nodeName);
    } else {
      alert("Please enter a node Address");
    }
  });

  leaveNetworkBtn.addEventListener("click", () => {
    // Send a message to the main process to handle "Leave Network" logic
    ipcRenderer.send("leave-network");
  });

  // Listen for updates to the node list from the main process
  ipcRenderer.on("update-node-list", (event, nodes) => {
    // Update the displayed list of nodes
    nodeList.innerHTML = nodes.map((node) => `<li>${node}</li>`).join("");
  });
});
