const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {
  const createNetworkBtn = document.getElementById("createNetworkBtn");
  const joinNetworkBtn = document.getElementById("joinNetworkBtn");
  const leaveNetworkBtn = document.getElementById("leaveNetworkBtn");
  const nodeNameInput = document.getElementById("nodeName");
  const nodeList = document.getElementById("nodeList");
  const notification = document.getElementById("notification");

  createNetworkBtn.addEventListener("click", async () => {
    const { info, nodeList } = await ipcRenderer.invoke("get-info");

    if (nodeList.length >= 1 || info.node.isPrimary) {
      showNotification("Node is already in a network!");
      return;
    }
    // Call to create network
    console.log("running create network");
    ipcRenderer.send("create-network", null);
  });

  joinNetworkBtn.addEventListener("click", async () => {
    const nodeAddress = nodeNameInput.value.trim();
    if (nodeAddress) {
      const { info, nodeList } = await ipcRenderer.invoke("get-info");
      if (nodeList.length >= 1 || info.node.isPrimary) {
        showNotification("Node is already in a network!");
        return;
      }
      ipcRenderer.send("join-network", nodeAddress);
    } else {
      showNotification("Please enter a node Address");
    }
  });

  leaveNetworkBtn.addEventListener("click", () => {
    // Send a message to the main process to handle "Leave Network" logic
    ipcRenderer.send("leave-network");
  });

  // Listen for updates to the node list from the main process
  ipcRenderer.on("update-node-list", (event, nodes) => {
    // Update the displayed list of nodes
    console.log(nodes);
    nodeList.innerHTML = nodes
      .map((node) => {
        const crownIcon = node.isPrimary ? "👑" : "";
        const statusIcon = node.alive ? "🟢" : "🔴";
        return `<li>${crownIcon}${node.uuid} | Status: ${statusIcon}</li>`;
      })
      .join("");
  });

  ipcRenderer.on("join-error", (event, error) => {
    showNotification("Error joining network!");
  });

  ipcRenderer.on("join-success", (event, error) => {
    showNotification("Successfully join network!");
  });

  ipcRenderer.on("leave-error", (event, error) => {
    showNotification("Error leaving network!");
  });

  ipcRenderer.on("leave-success", (event, error) => {
    showNotification("Successfully left network!");
  });

  ipcRenderer.on("create-success", (event, error) => {
    showNotification("Successfully created network!");
  });

  ipcRenderer.on("error", (event, error) => {
    showNotification("UHOH an internal server error happened");
  });
  function showNotification(message) {
    // Display the message in the notification element
    notification.textContent = message;
    notification.style.display = "block";

    // Clear the notification after a short delay (e.g., 3 seconds)
    setTimeout(() => {
      notification.textContent = "";
      notification.style.display = "none";
    }, 3000);
  }
});
