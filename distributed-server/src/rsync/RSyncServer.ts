import { Server, utils } from "ssh2";
import { timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import { inspect } from "util";

export class RSyncServer {
  private server: Server;
  private allowedUser: Buffer;
  private allowedPassword: Buffer;
  private allowedPubKey: utils.Key;

  constructor() {
    this.allowedUser = Buffer.from("username");
    this.allowedPassword = Buffer.from("password");
    this.allowedPubKey = utils.parseKey(
      readFileSync("./src/rsync/ssh/minecraftServer.pub")
    );

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

  private handleConnection(client: Server): void {
    console.log("Client connected!");

    client
      .on("authentication", (ctx) => {
        let allowed = true;

        if (!this.checkValue(Buffer.from(ctx.username), this.allowedUser)) {
          allowed = false;
        }

        switch (ctx.method) {
          case "password":
            if (
              !this.checkValue(Buffer.from(ctx.password), this.allowedPassword)
            ) {
              return ctx.reject();
            }
            break;
          case "publickey":
            if (
              ctx.key.algo !== this.allowedPubKey.type ||
              !this.checkValue(
                ctx.key.data,
                this.allowedPubKey.getPublicSSH()
              ) ||
              (ctx.signature &&
                this.allowedPubKey.verify(
                  ctx.blob,
                  ctx.signature,
                  ctx.hashAlgo
                ) !== true)
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
                stream.stderr.write(
                  `Error executing rsync: ${error.message}\n`
                );
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
      .on("pty", (accept, reject, info) => {
        console.log(
          `PTY request received: ${info.term} ${info.cols} cols, ${info.rows} rows`
        );
        accept();
      })
      .on("close", () => {
        console.log("Client disconnected");
      });
  }

  public startServer(port, address): void {
    this.server.listen(port, address, () => {
      console.log("Listening on port " + this.server.address().port);
    });
  }

  public async stopServer() {
    console.log("stopping SSH server");
    await this.server.close(() => {
      console.log("Server stopped");
    });
  }
}
