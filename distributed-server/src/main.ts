import { DistributedServerNode, loadFromFile } from "./distributedNode/distributedNode";
import os from "os";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let localIP = null;

  Object.keys(interfaces).forEach((interfaceName) => {
    const interfaceInfo = interfaces[interfaceName];

    for (const iface of interfaceInfo) {
      // Skip over internal (i.e., 127.0.0.1) and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  });

  return localIP;
}

const lanIP = getLocalIP();

function main() {
  // Initialize networks
  // Find public IP
  const localIpAddress = getLocalIP();
  const address: string = localIpAddress;
  console.log(address);
  const httpPort: number = 8080;
  const rSyncPort: number = 8081;
  const minecraftPort: number = 8082;

  let node: DistributedServerNode = loadFromFile();
  if (node == null) {
    console.log("creating new node");
    node = new DistributedServerNode(address, httpPort, rSyncPort, minecraftPort, null, null, null, null, null, null);
  }
  node.start();
  console.log("Distributed node up!"); // Print a message to the console
}

// Call the main function
main();
