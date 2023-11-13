import fastify from "fastify";
import { MinecraftServerAdaptor } from "../minecraftServerAdaptor/MinecraftServerAdaptor";
import { RSyncServer } from "../rsync/RSyncServer";
import { routes } from "./routes";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import { DistributedNode } from "./node/distributedNodeInterface";
import axios, { AxiosError } from "axios";

const FILEPATH = "./src/distributedNode/node/save.json";
const ENV = "dev";
export class DistributedServerNode {
  // Network
  private mainPort: number;
  private rsyncPort: number;
  private minecraftPort: number;
  private address: string;

  // Main Server
  private mainServer: any;

  // RSync Server
  private rSyncServer: RSyncServer;

  // Internal data
  public isPrimaryNode: boolean;
  public inNetwork: boolean;
  public networkNodes: DistributedNode[];
  public uuid: string;
  public primaryNode: DistributedNode;
  public selfNode: DistributedNode;

  constructor(
    address: string,
    mainPort: number,
    rsyncPort: number,
    minecraftPort: number,
    isPrimaryNode: boolean,
    inNetwork: boolean,
    networkNodes: DistributedNode[],
    uuid: string
  ) {
    this.mainPort = mainPort;
    this.rsyncPort = rsyncPort;
    this.minecraftPort = minecraftPort;
    this.address = address;
    this.isPrimaryNode = isPrimaryNode || false;
    this.inNetwork = inNetwork || false;
    this.uuid = uuid || null;

    this.selfNode = {
      uuid: this.uuid,
      address: this.address,
      distributedPort: this.mainPort,
      rsyncPort: this.rsyncPort,
      minecraftPort: this.minecraftPort,
      alive: true,
      isPrimary: this.isPrimaryNode,
    };

    this.networkNodes = networkNodes || [this.selfNode];
    this.primaryNode = this.findPrimaryNode();
  }

  private findPrimaryNode() {
    for (const node of this.networkNodes) {
      if (node.isPrimary) {
        return node;
      }
    }
    return null;
  }

  public start(): void {
    this.initDistributedServer();
    if (this.isPrimaryNode) {
      // No need to init mc server
      if (ENV != "dev") {
        this.initMCServerApplication();
      }
      this.initRsyncServer();
    }
    this.initProcesses();
  }

  private initDistributedServer(): void {
    this.mainServer = fastify();
    // Define a route
    routes(this.mainServer, this);
    // Start the server on the specified port
    this.mainServer.listen({ port: this.mainPort }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Server listening at ${address}`);
    });
  }

  private initMCServerApplication(): void {
    MinecraftServerAdaptor.startMinecraftServer("../minecraft-server");
  }

  private initRsyncServer(): void {
    this.rSyncServer = new RSyncServer();
    this.rSyncServer.startServer(this.rsyncPort, "localhost");
  }

  private initProcesses() {
    process.on("beforeExit", async () => {
      await MinecraftServerAdaptor.shutdownMinecraftServer();
      await this.rSyncServer.stopServer();
    });

    process.on("SIGINT", async () => {
      await MinecraftServerAdaptor.shutdownMinecraftServer();
      await this.rSyncServer.stopServer();
      process.exit(1);
    });

    process.on("SIGTERM", async () => {
      await MinecraftServerAdaptor.shutdownMinecraftServer();
      await this.rSyncServer.stopServer();
      process.exit(1);
    });
  }

  private saveToFile() {
    try {
      const serializedNode = JSON.stringify(this, null, 2);

      fs.writeFileSync(FILEPATH, serializedNode, "utf8");
      console.log("DistributedServerNode saved to file successfully.");
    } catch (err) {
      console.error("Error saving DistributedServerNode to file:", err);
    }
  }

  // Distributed Node functions

  public createNetwork() {
    this.isPrimaryNode = true;
    this.inNetwork = true;
    this.networkNodes = [];
    this.uuid = uuidv4();
    this.saveToFile();

    this.initMCServerApplication();
    this.initRsyncServer();
  }

  public async joinNetwork({ address }) {
    const requestURL = `${address}/network`;
    console.log(requestURL);
    try {
      const results = await axios.put(requestURL, this.selfNode);
      // Handle the results if needed
      console.log(results.data);
      return results.data; // or whatever you want to return
    } catch (error) {
      // Handle the error
      console.error("Error joining network:", error.message);
    }
  }

  public leaveNetwork() {
    // If it is primary, remove itself from all other nodes in the server
    if (this.isPrimaryNode) {
      this.removeNetworkNode(this.uuid);
      this.propagateNetworkNodeList();
    } else {
      // If not, tell primary to remove itself from all other nodes in the server
    }

    this.isPrimaryNode = false;
    this.inNetwork = false;
    this.networkNodes = [];
    this.uuid = null;
    this.saveToFile();
  }

  // Netww
  public addNetworkNode(data: any) {}

  public removeNetworkNode(uuid: string) {
    const indexToRemove = this.networkNodes.findIndex((node) => node.uuid === uuid);
    if (indexToRemove !== -1) {
      this.networkNodes.splice(indexToRemove, 1);
      console.log(`Network node with UUID ${uuid} removed successfully.`);
    } else {
      console.warn(`Network node with UUID ${uuid} not found.`);
    }
  }

  private sendPutRequest(node: DistributedNode): Promise<void> {
    const url = `${node.address}/api/endpoint`; // Replace with your actual endpoint
    return axios
      .put(url, {
        /* Your PUT request payload */
      })
      .then(() => console.log(`PUT request to ${url} successful.`))
      .catch((error: AxiosError) => {
        console.error(`Error in PUT request to ${url}:`, error.message);
        //Test if server is dead
      });
  }

  public async propagateNetworkNodeList(): Promise<void> {
    const requestPromises = this.networkNodes.map((node) => {
      // Dont send to itself
      if (node.uuid != this.uuid) {
        this.sendPutRequest(node);
      }
    });

    try {
      await Promise.all(requestPromises);
      console.log("All PUT requests completed successfully.");
    } catch (error) {
      console.error("At least one PUT request failed:", error.message);
    }
  }
}

export function loadFromFile(): DistributedServerNode | null {
  try {
    const data = fs.readFileSync(FILEPATH, "utf8");
    const parsedData = JSON.parse(data);

    // Assuming DistributedServerNode is your class
    const loadedNode = new DistributedServerNode(
      parsedData.address,
      parsedData.mainPort,
      parsedData.rsyncPort,
      parsedData.minecraftPort,
      parsedData.isPrimaryNode,
      parsedData.inNetwork,
      parsedData.networkNodes,
      parsedData.uuid
    );

    console.log("DistributedServerNode loaded from file successfully.");
    return loadedNode;
  } catch (err) {
    console.error("Error reading/parsing DistributedServerNode from file:", err);
    return null;
  }
}
