import * as ssh2 from "ssh2";

export class RSyncClient {
  private conn: ssh2.Client;

  constructor(private connectOptions: ssh2.ConnectConfig) {
    this.conn = new ssh2.Client();
  }

  public connect(): void {
    this.conn
      .on("ready", () => {
        console.log("SSH connection established");

        // Execute the rsync
        this.conn.exec(
          "rsync -avz --delete ../minecraft-server/world ../minecraft-server",
          (err, stream) => {
            if (err) throw err;

            stream
              .on("close", (code, signal) => {
                console.log(
                  `Command exited with code ${code}, signal ${signal}`
                );
                this.conn.end();
              })
              .on("data", (data) => {
                console.log(`STDOUT: ${data}`);
              })
              .stderr.on("data", (data) => {
                console.log(`STDERR: ${data}`);
              });
          }
        );
      })
      .on("error", (err) => {
        console.error(`Error: ${err.message}`);
      })
      .connect(this.connectOptions);
  }
}
