import chokidar from "chokidar";
import axios from "axios";
import { join, basename } from "path";
import { readFileSync, writeFileSync, ensureFileSync, existsSync, ensureDir } from "fs-extra";
import { DistributedNode } from "../distributedNode/node/distributedNodeInterface";
import { DistributedServerNode } from "../distributedNode/distributedNode";
import path from "path";

export class FileWatcher {
  private directoriesToWatch: string[];
  private watchers: chokidar.FSWatcher[];
  private fileQueue: { order: number; filePath: string }[];
  public counter: number;
  private initialScanComplete: boolean;
  private node: DistributedServerNode;

  constructor(directoriesToWatch: string[], node: DistributedServerNode) {
    this.directoriesToWatch = directoriesToWatch;
    this.watchers = directoriesToWatch.map((dir) => chokidar.watch(dir, { persistent: true }));
    this.fileQueue = [];
    this.counter = 1;
    this.initialScanComplete = false;
    this.node = node;

    // Load the fileQueue from the saved JSON file
    this.loadQueueFromFile();
  }

  private setupEventHandlers(): void {
    this.watchers.forEach((watcher, index) => {
      watcher
        .on("add", (path) => this.handleFileChange("add", path))
        .on("change", (path) => this.handleFileChange("change", path))
        .on("unlink", (path) => this.handleFileChange("unlink", path))
        .on("ready", () => {
          this.initialScanComplete = true;
        });
    });
  }

  private async handleFileChange(event: string, filePath: string) {
    if (!this.initialScanComplete) {
      return;
    }

    if (basename(filePath) === "session.lock") {
      console.log(`Ignoring file: ${filePath}`);
      return;
    }

    let fileContent: any | null = null;
    let retryAttempts = 3; // Set the number of retry attempts

    while (retryAttempts > 0) {
      try {
        fileContent = readFileSync(filePath);
        break; // Break out of the loop if read is successful
      } catch (error) {
        console.error(`Error reading file: ${filePath}`, error.message);
        retryAttempts--;

        if (retryAttempts === 0) {
          console.error(`Maximum retry attempts reached. Unable to read file: ${filePath}`);
          return;
        }

        // Add a delay before retrying (e.g., 1 second)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.fileQueue.push({ order: this.counter++, filePath });

    this.saveQueueToFile();

    await this.propagateFileChange(event, filePath, fileContent);

    console.log(`File change processed: ${event} - ${filePath}`);
  }

  public async propagateFileChange(event: string, filePath: string, fileContent: string): Promise<void> {
    const requestPromises = this.node.networkNodes.map((node) => {
      if (node.uuid !== this.node.uuid) {
        this.sendFileChange(node, event, filePath, fileContent);
      }
    });

    try {
      await Promise.all(requestPromises);
      console.log("All FileHandle requests completed successfully.");
    } catch (error) {
      console.error("At least one PUT request failed:", error.message);
    }
  }

  private sendFileChange(node: DistributedNode, event: string, filePath: string, fileContent: any) {
    const url = `http://${node.address}:${node.distributedPort}/file-change`;
    const data = {
      event,
      filePath,
      fileContent: fileContent.toString("base64"),
      order: this.fileQueue.slice(), // Send a copy of the current order
    };

    return axios
      .put(url, data)
      .then((response) => {})
      .catch((error) => {
        console.error(`Error sending file change: ${event} - ${filePath}`, error.message);
      });
  }

  private loadQueueFromFile(): void {
    const FILEQUEUE = "./src/fileSync";
    const queueFilePath = join(FILEQUEUE, "fileQueue.json");

    if (!existsSync(queueFilePath)) {
      ensureFileSync(queueFilePath);
      this.counter = 1;
      this.fileQueue = [];
      writeFileSync(queueFilePath, JSON.stringify(this.fileQueue, null, 2), "utf-8");
    }

    const fileQueueContent = readFileSync(queueFilePath, "utf-8");

    try {
      this.fileQueue = JSON.parse(fileQueueContent);
      this.counter = this.fileQueue[this.fileQueue.length - 1].order + 1;

      console.log(`FileQueue loaded. Latest counter: ${this.counter}`);
    } catch (error) {
      console.error(`Error parsing fileQueue JSON: ${error.message}`);
    }
  }

  private saveQueueToFile(): void {
    const FILEQUEUE = "./src/fileSync";
    const queueFilePath = join(FILEQUEUE, "fileQueue.json");

    try {
      ensureFileSync(queueFilePath);
      writeFileSync(queueFilePath, JSON.stringify(this.fileQueue, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error saving queue to file: ${error.message}`);
    }
  }

  startWatching(): void {
    this.setupEventHandlers();
    console.log(`Watching directories: ${this.directoriesToWatch.join(", ")}`);
  }

  stopWatching(): void {
    this.watchers.forEach((watcher, index) => {
      watcher.close();
      console.log(`Stopped watching directory: ${this.directoriesToWatch[index]}`);
    });
  }

  public getFileQueue() {
    return this.fileQueue;
  }

  public async recovery() {
    console.log("Running recovery");
    const URL = `http://${this.node.primaryNode.address}:${this.node.primaryNode.distributedPort}/request-file-log`;

    const result = await axios.get(URL);
    const fileQueue = result.data;
    const difference = this.findDifferenceQueue(fileQueue);
    await this.getAllFiles(difference);
    this.fileQueue = fileQueue;

    this.saveQueueToFile();
    console.log("Recovery complete");
  }

  private findDifferenceQueue(fileQueue) {
    // Trim fileQueue to only counters after its current counter
    const trimmedFileQueue = fileQueue.filter((file) => file.order >= this.counter);
    // Find Map, storing the latest order of the file path
    const latestOrderMap = new Map();
    for (const file of trimmedFileQueue) {
      const existingOrder = latestOrderMap.get(file.filePath);
      if (existingOrder === undefined || file.order > existingOrder) {
        latestOrderMap.set(file.filePath, file.order);
      }
    }
    const sortedArray = Array.from(latestOrderMap.entries()).sort((a, b) => a[1] - b[1]);
    return sortedArray;
  }

  private async getAllFiles(difference) {
    // get file in batches so to not overload server
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < difference.length; i += batchSize) {
      batches.push(difference.slice(i, i + batchSize));
    }

    // Send requests for each batch
    for (const batch of batches) {
      const promises = batch.map(async (entry) => {
        const order = entry[1];
        let filePath = entry[0];
        filePath = filePath.replace(/\\/g, "/");

        const URL = `http://${this.node.primaryNode.address}:${this.node.primaryNode.distributedPort}`;
        try {
          const response = await axios.post(`${URL}/missing-files`, { filePath });
          console.log("recieved", filePath);
          let { content } = response.data;
          content = Buffer.from(content, "base64");
          const directoryPath = path.dirname(filePath);
          ensureDir(directoryPath);
          writeFileSync(filePath, content);
          this.counter = order;
          console.log(`Recieved file: ${filePath}`);
        } catch (error) {
          console.error(`Error fetching file ${filePath}:`);
        }
      });

      // Wait for all requests in the current batch to complete before moving to the next batch
      await Promise.all(promises);
    }
  }
}
