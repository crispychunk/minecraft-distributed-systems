import * as ssh2 from "ssh2";

export class RSyncClient {
  private conn: ssh2.Client;

  constructor(private connectOptions: ssh2.ConnectConfig) {
    this.conn = new ssh2.Client();
    this.setupConnection();
  }

  private setupConnection(): void {
    this.conn
      .on("ready", () => {
        console.log("SSH connection established");
      })
      .on("error", (err) => {
        console.error(`Error: ${err.message}`);
      })
      .connect(this.connectOptions);
  }

  public run(command: string, callback?: (error: Error | null, result: string) => void): void {
    // Execute the rsync
    this.conn.exec(command, (err, stream) => {
      if (err) {
        if (callback) {
          callback(err, "");
        }
        return;
      }

      let stdoutData = "";
      let stderrData = "";

      stream
        .on("close", (code, signal) => {
          console.log(`Command exited with code ${code}`);
          const result = stderrData ? stderrData : stdoutData;
          if (callback) {
            callback(null, result);
          }
        })
        .on("data", (data) => {
          stdoutData += data;
        })
        .stderr.on("data", (data) => {
          stderrData += data;
        });
    });
  }

  public endConnection(): void {
    this.conn.end();
    console.log("SSH connection ended");
  }
}
