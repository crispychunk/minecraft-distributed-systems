import { Server, utils, Connection } from "ssh2";
import { timingSafeEqual } from "crypto";
import { readFileSync } from "fs";

export class RSyncServer {
  private server: Server;
  private allowedUser: Buffer;
  private allowedPassword: Buffer;
  private allowedPubKey: utils.Key;
  private activeConnections: Connection[] = [];

  constructor() {
    this.allowedUser = Buffer.from("username");
    this.allowedPassword = Buffer.from("password");
    this.allowedPubKey = utils.parseKey(readFileSync("./src/rsync/ssh/minecraftServer.pub"));

    this.server = new Server(
      {
        hostKeys: [readFileSync("./src/rsync/ssh/minecraftServer.pem")],
      },
      this.handleConnection.bind(this)
    );
  }

  private checkValue(input: Buffer, allowed: Buffer): boolean {
    const autoReject = input.length !== allowed.length;
    if (autoReject) {
      allowed = input;
    }
    const isMatch = timingSafeEqual(input, allowed);
    return !autoReject && isMatch;
  }

  private handleConnection(client: Connection): void {
    console.log("Client connected!");

    this.activeConnections.push(client);

    client
      .on("authentication", (ctx) => {
        let allowed = true;

        if (!this.checkValue(Buffer.from(ctx.username), this.allowedUser)) {
          allowed = false;
        }

        switch (ctx.method) {
          case "password":
            if (!this.checkValue(Buffer.from(ctx.password), this.allowedPassword)) {
              return ctx.reject();
            }
            break;
          case "publickey":
            if (
              ctx.key.algo !== this.allowedPubKey.type ||
              !this.checkValue(ctx.key.data, this.allowedPubKey.getPublicSSH()) ||
              (ctx.signature && this.allowedPubKey.verify(ctx.blob, ctx.signature, ctx.hashAlgo) !== true)
            ) {
              return ctx.reject();
            }
            break;
          default:
            return ctx.reject();
        }

        if (allowed) {
          ctx.accept();
        } else {
          ctx.reject();
        }
      })
      .on("ready", () => {
        console.log("Client authenticated!");
        client.on("session", (accept, reject) => {
          const session = accept();
          session.once("exec", (accept, reject, info) => {
            // Handle Rsync codes here
            if (info.command.startsWith("rsync")) {
              const stream = accept({ pty: true });
              stream.stderr.write("Rsync command detected\n");

              const rsyncCommand = info.command;
              const childProcess = require("child_process").exec(rsyncCommand);

              childProcess.stdout.on("data", (data) => {
                console.log(data);
                stream.write(data);
              });

              // Handle errors and close the stream when the command finishes
              childProcess.on("error", (error) => {
                console.error(`Error executing rsync: ${error.message}`);
                stream.stderr.write(`Error executing rsync: ${error.message}\n`);
              });

              childProcess.on("close", (code) => {
                console.log(`Rsync command executed with code ${code}`);
                stream.exit(code);
                stream.end();
              });
            } else {
              const stream = reject(); // Reject non-rsync commands
              stream.end();
            }
          });
        });
      })
      .on("end", () => {
        const index = this.activeConnections.indexOf(client);
        if (index !== -1) {
          this.activeConnections.splice(index, 1);
        }
      });
  }

  public startServer(port: number, address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, address, () => {
        const serverPort = this.server.address().port;
        console.log(`Listening on port ${serverPort}`);
        resolve();
      });

      this.server.on("error", (error) => {
        reject(error);
      });
    });
  }

  public stopServer(): Promise<void> {
    console.log("Stopping SSH server");
    return new Promise((resolve, reject) => {
      // Close all active connections
      this.activeConnections.forEach((connection) => {
        connection.end();
      });

      this.server.close((error) => {
        if (error) {
          console.error(`Error stopping server: ${error}`);
          reject(error);
        } else {
          console.log("SSH Server stopped");
          resolve();
        }
      });
    });
  }
}
