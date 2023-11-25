import { DistributedServerNode, loadFromFile } from "./distributedNode/distributedNode";
import os from "os";

function getLocalIPv4Address(): string | null {
  const interfaces = os.networkInterfaces();

  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];

    for (const iface of interfaceInfo) {
      // Check for IPv4 and exclude loopback and internal addresses
      console.log(iface);
      if (
        (iface.family === "IPv4" || (iface.family as any) === 4) &&
        !iface.internal &&
        iface.address !== "127.0.0.1"
      ) {
        return iface.address;
      }
    }
  }

  return null;
}

function main() {
  // Initialize networks
  // Find public IP
  const localIpAddress = getLocalIPv4Address();
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
