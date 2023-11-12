import fastify from "fastify";
import { MinecraftServerAdaptor } from "../minecraftServerAdaptor/MinecraftServerAdaptor";
import { RSyncServer } from "../rsync/RSyncServer";
import { routes } from "./routes";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import { DistributedNode } from "./node/distributedNodeInterface";
const FILEPATH = "./src/distributedNode/node/save.json";

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

  constructor(
    address: string,
    mainPort: number,
    rsyncPort: number,
    minecraftPort: number,
    isPrimaryNode: boolean,
    isNetwork: boolean,
    networkNodes: DistributedNode[],
    uuid: string
  ) {
    this.mainPort = mainPort;
    this.rsyncPort = rsyncPort;
    this.minecraftPort = minecraftPort;
    this.address = address;
    this.isPrimaryNode = isPrimaryNode || false;
    this.inNetwork = isNetwork || false;
    this.networkNodes = networkNodes || [];
    this.uuid = uuid || null;
    this.init();
  }

  public init(): void {
    this.initDistributedServer();
    if (this.isPrimaryNode) {
      this.initMCServerApplication();
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

  public createNetwork() {
    this.isPrimaryNode = true;
    this.inNetwork = true;
    this.networkNodes = [];
    this.uuid = uuidv4();
    this.saveToFile();

    this.initMCServerApplication();
    this.initRsyncServer();
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
      parsedData.isNetwork,
      parsedData.networkNodes,
      parsedData.uuid
    );
    Object.assign(loadedNode, parsedData);

    console.log("DistributedServerNode loaded from file successfully.");
    return loadedNode;
  } catch (err) {
    console.error(
      "Error reading/parsing DistributedServerNode from file:",
      err
    );
    return null;
  }
}
