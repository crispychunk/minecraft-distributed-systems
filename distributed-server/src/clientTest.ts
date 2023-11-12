import { RSyncClient } from "./rsync/RSyncClient";

const sshClient = new RSyncClient({
  host: "localhost",
  port: 8081,
  username: "username",
  privateKey: require("fs").readFileSync("./src/rsync/ssh/minecraftServer.pem"),
});

sshClient.connect();
