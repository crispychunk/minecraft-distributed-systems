import { exec } from "child_process";
import * as path from "path";
import axios from "axios";

export class MinecraftServerAdaptor {
  private static serverProcess: any;

  public static startMinecraftServer(serverFolderRelativePath: string): void {
    // Get the current working directory
    const currentWorkingDirectory: string = process.cwd();
    console.log(`Current working directory: ${currentWorkingDirectory}`);

    // Construct the full path to the start.bat script
    const serverFolder: string = path.join(currentWorkingDirectory, serverFolderRelativePath);

    // Create the command and its arguments separately
    const command: string = process.platform === "win32" ? "cmd" : "sh";
    const argument: string = process.platform === "win32" ? "/c start.bat" : "start.sh";

    const processOptions = {
      cwd: serverFolder,
      windowsHide: true,
    };

    MinecraftServerAdaptor.serverProcess = exec(`${command} ${argument}`, processOptions, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting Minecraft server: ${error.message}`);
      }
    });

    console.log("Minecraft server has been started.");
  }

  public static async shutdownMinecraftServer(): Promise<void> {
    try {
      // Send message to Minecraft server to shut down
      const SHUTDOWN_COMMAND = "http://localhost:8085/shutdown";
      const response = await axios.put(SHUTDOWN_COMMAND);

      if (response.status === 200) {
        console.log("Shutting down Minecraft server");
      } else {
        console.error("Failed to shut down Minecraft server. Unexpected response:", response.status);
      }

      // Terminate the server process
      if (MinecraftServerAdaptor.serverProcess) {
        MinecraftServerAdaptor.serverProcess.kill();
        console.log("Minecraft server has been shut down.");
      }
    } catch (error) {
      // Handle errors
      console.error("Error shutting down Minecraft server:", error.message);
    }
  }
}
