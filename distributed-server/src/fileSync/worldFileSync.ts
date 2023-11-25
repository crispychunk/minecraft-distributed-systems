import chokidar from "chokidar";
import axios from "axios";
import { join, basename } from "path";
import { readFileSync, writeFileSync, ensureFileSync, existsSync } from "fs-extra";
import { DistributedNode } from "../distributedNode/node/distributedNodeInterface";
import { DistributedServerNode } from "../distributedNode/distributedNode";

export class FileWatcher {
  private directoriesToWatch: string[];
  private watchers: chokidar.FSWatcher[];
  private fileQueues: { order: number; filePath: string }[][];
  private counters: number[];
  private initialScanCompletes: boolean[];
  private node: DistributedServerNode;

  constructor(directoriesToWatch: string[], node: DistributedServerNode) {
    this.directoriesToWatch = directoriesToWatch;
    this.watchers = directoriesToWatch.map((dir) => chokidar.watch(dir, { persistent: true }));
    this.fileQueues = directoriesToWatch.map(() => []);
    this.counters = directoriesToWatch.map(() => 1);
    this.initialScanCompletes = directoriesToWatch.map(() => false);
    this.node = node;

    // Load the fileQueues from the saved JSON file
    this.loadQueuesFromFile();
  }

  private setupEventHandlers(index: number): void {
    this.watchers[index]
      .on("add", (path) => this.handleFileChange("add", path, index))
      .on("change", (path) => this.handleFileChange("change", path, index))
      .on("unlink", (path) => this.handleFileChange("unlink", path, index))
      .on("ready", () => {
        this.initialScanCompletes[index] = true;
      });
  }

  private async handleFileChange(event: string, filePath: string, index: number) {
    if (!this.initialScanCompletes[index]) {
      return;
    }

    if (basename(filePath) === "session.lock") {
      console.log(`Ignoring file: ${filePath}`);
      return;
    }

    let fileContent: string | null = null;
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

    this.fileQueues[index].push({ order: this.counters[index]++, filePath });

    this.saveQueueToFile(index);

    await this.propagateFileChange(event, filePath, fileContent, index);

    console.log(`File change processed: ${event} - ${filePath}`);
  }

  public async propagateFileChange(
    event: string,
    filePath: string,
    fileContent: string,
    senderIndex: number
  ): Promise<void> {
    const requestPromises = this.node.networkNodes.map((node) => {
      if (node.uuid !== this.node.uuid) {
        this.sendFileChange(node, event, filePath, fileContent, senderIndex);
      }
    });

    try {
      await Promise.all(requestPromises);
      console.log("All FileHandle requests completed successfully.");
    } catch (error) {
      console.error("At least one PUT request failed:", error.message);
    }
  }

  private sendFileChange(
    node: DistributedNode,
    event: string,
    filePath: string,
    fileContent: string,
    senderIndex: number
  ) {
    const url = `http://${node.address}:${node.distributedPort}/file-change`;
    const data = {
      event,
      filePath,
      fileContent,
      order: this.fileQueues[senderIndex].slice(), // Send a copy of the current order
    };

    return axios
      .put(url, data)
      .then((response) => {})
      .catch((error) => {
        console.error(`Error sending file change: ${event} - ${filePath}`, error.message);
      });
  }

  private loadQueuesFromFile(): void {
    this.directoriesToWatch.forEach((directory, index) => {
      const queueFilePath = join(directory, "fileQueue.json");

      if (existsSync(queueFilePath)) {
        const fileQueueContent = readFileSync(queueFilePath, "utf-8");
        try {
          this.fileQueues[index] = JSON.parse(fileQueueContent);
          console.log(`FileQueue for directory ${directory} loaded from file.`);
        } catch (error) {
          console.error(`Error parsing fileQueue JSON: ${error.message}`);
        }
      }
    });
  }

  private saveQueueToFile(index: number): void {
    if (!this.initialScanCompletes[index]) {
      return;
    }

    const queueFilePath = join(this.directoriesToWatch[index], "fileQueue.json");

    try {
      ensureFileSync(queueFilePath);
      writeFileSync(queueFilePath, JSON.stringify(this.fileQueues[index], null, 2), "utf-8");
    } catch (error) {
      console.error(`Error saving queue to file: ${error.message}`);
    }
  }

  startWatching(): void {
    this.directoriesToWatch.forEach((directory, index) => {
      this.setupEventHandlers(index);
      console.log(`Watching directory: ${directory}`);
    });
  }

  stopWatching(): void {
    this.watchers.forEach((watcher, index) => {
      watcher.close();
      console.log(`Stopped watching directory: ${this.directoriesToWatch[index]}`);
    });
  }
}
