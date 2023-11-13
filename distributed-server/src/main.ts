import { DistributedServerNode, loadFromFile } from "./distributedNode/distributedNode";
function main() {
  // Initialize networks
  // Find public IP
  const address: string = "localhost";
  const httpPort: number = 8080;
  const rSyncPort: number = 8081;
  const minecraftPort: number = 8082;

  let node: DistributedServerNode = loadFromFile();
  if (node == null) {
    console.log("creating new node");
    node = new DistributedServerNode(address, httpPort, rSyncPort, minecraftPort, null, null, null, null);
  }
  console.log("Distributed node up!"); // Print a message to the console
}

// Call the main function
main();
