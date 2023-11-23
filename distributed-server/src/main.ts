import { DistributedServerNode, loadFromFile } from "./distributedNode/distributedNode";
import { networkInterfaces } from "os";

function getLocalIpAddress(): string | null {
  const interfaces = networkInterfaces();
  const addresses: string[] = [];

  Object.keys(interfaces).forEach((ifname) => {
    interfaces[ifname]?.forEach((iface) => {
      if ("IPv4" === iface.family && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });

  return addresses.length > 0 ? addresses[0] : null;
}

function main() {
  // Initialize networks
  // Find public IP
  const localIpAddress = getLocalIpAddress();
  const address: string = localIpAddress;
  console.log(localIpAddress);
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
