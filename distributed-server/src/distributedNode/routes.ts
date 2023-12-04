import fs from "fs-extra";
import { DistributedServerNode } from "./distributedNode";
import * as path from "path";

export const routes = (mainServer, node: DistributedServerNode) => {
  // Base route
  mainServer.get("/", async (request, reply) => {
    return { hello: "world" };
  });

  // Base route
  mainServer.get("/info", async (request, reply) => {
    const info = node.getServerInformation();
    return { info };
  });

  /* 
  NETWORK ROUTES
  These routes handle join/leaving/creating a network
  */
  // Route for starting a network
  mainServer.post("/create-network", async (request, reply) => {
    // if already in network, fail
    if (node.inNetwork) {
      return reply.code(400).send({ error: "Already in the network" });
    }
    // create network
    node.createNetwork();

    return { message: "Network started successfully" };
  });

  // Route to tell node to join a network
  mainServer.put("/request-network", async (request, reply) => {
    // Logic for joining a network goes here
    if (node.inNetwork) {
      return reply.code(400).send({ error: "Already in a network" });
    }
    node.requestNetwork(request.body);

    return { message: "Requested to join network", data: request.data };
  });

  // Primary server route to send to server the node info
  mainServer.put("/join-network", async (request, reply) => {
    if (!node.isPrimaryNode) {
      return reply.code(400).send({ error: "Not a primary node!" });
    }
    console.log("Adding node to network");
    const networkNode = node.acceptJoinNetwork(request.body);
    return reply.code(200).send({ data: networkNode });
  });

  // Route for primary server to send network info to requestor
  mainServer.put("/update-network", async (request, reply) => {
    // Logic for joining a network goes here
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "This node is not in a network" });
    }
    if (node.isPrimaryNode) {
      return reply.code(400).send({ error: "This node is a primary node!" });
    }
    // Update self node list
    node.updateNodeList(request.body);
    return { message: "Network node updated successfully" };
  });

  mainServer.delete("/request-leave-network", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Already not in the network" });
    }
    // Logic for leaving a network
    node.requestLeaveNetwork();

    return { message: "Network left successfully" };
  });

  mainServer.put("/leave-network", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Already not in the network" });
    }

    if (!node.isPrimaryNode) {
      return reply.code(400).send({ error: "Not a primary node!" });
    }
    // Logic for leaving a network
    await node.acceptLeaveNetwork(request.body);

    return { message: "Removed node successfully" };
  });

  // FILE SYNC

  mainServer.put("/file-change", async (request, reply) => {
    try {
      let { event, filePath, fileContent, order } = request.body;
      // Check if the order is the next one, if it is run the code, else run recovery:
      filePath = filePath.replace(/\\/g, "/");
      console.log(order, filePath);
      if (order == node.fileWatcher.counter + 1 && !node.fileWatcher.inRecovery) {
        node.fileWatcher.counter++;
        let directoryPath = path.dirname(filePath);
        await fs.ensureDir(directoryPath);
        console.log(filePath);
        const decodedFileContent = Buffer.from(fileContent, "base64");
        fs.writeFileSync(filePath, decodedFileContent);
        node.fileWatcher.addFileToQueue(filePath);

        console.log("recieved file changes");
        reply.code(200).send({ message: "File change received and saved successfully" });
      } else {
        if (!node.fileWatcher.inRecovery) {
          node.fileWatcher.recovery();
        }
      }
    } catch (error) {
      console.error("Error handling file change:", error.message);
      reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  //FILE SYNC FAILURE RECOVERY OR JOINING A NODE

  mainServer.get("/request-file-log", async (request, reply) => {
    const data = node.fileWatcher.getFileQueue();
    reply.code(200).send(data);
  });

  mainServer.get("/test-recovery", async (request, reply) => {
    console.log("Running test recovery");
    await node.fileWatcher.recovery();
    reply.code(200);
  });

  mainServer.post("/missing-files", async (request, reply) => {
    try {
      const { filePath } = request.body;
      console.log(filePath);

      try {
        let content = fs.readFileSync(filePath);
        content = content.toString("base64");
        return reply.send({ content });
      } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
        return reply.code(500).send({ error: "Internal Server Error" });
      }
    } catch (error) {
      console.error("Error handling /missing-files:", error.message);
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  });

  //DISTRIBUTED NODE RECOVERY PATH

  // Node calls primary server to faciliate recovery
  mainServer.put("/request-recovery", async (request, reply) => {
    const { failedNode } = request.body;
    node.recoverNode(failedNode);
    const networkNodes = node.networkNodes;
    reply.code(200).send({ networkNodes });
  });

  /* 
  Heartbeat Routes
    These routes are called to make sure the server is alive. The primary server will call these routes to all other nodes
  */

  mainServer.get("/heartbeat", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }
    if (node.isPrimaryNode) {
      return reply.code(400).send({ error: "This is a primary node!" });
    }
    //Recieved heartbeat from the primary so its good
    console.log("Heartbeat recieved from primary");
    node.resetHeartbeatTimer();
    return { message: "Heartbeat Recieved" };
  });

  /* 
  Leadership Routes
   These routes are for leadership elections and proposal 
  */
  mainServer.put("/request-vote", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }
    if (node.isPrimaryNode) {
      return reply.code(400).send({ error: "This is a primary node!" });
    }
    //Recieved heartbeat from the primary so its good
    const { candidateTerm, candidateId } = request.body;
    const result = node.handleRequestVote(candidateTerm, candidateId);
    if (result.accepted) {
      return reply.code(200).send(result);
    } else {
      return reply.code(400).send(result);
    }
  });

  // Have new primary send this after it has garner enough votes
  mainServer.post("/new-leader", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }
    if (node.isPrimaryNode) {
      return reply.code(400).send({ error: "This is a primary node!" });
    }
    //End election timeout and reinitiate all routines
    node.acceptLeadership(request.body);
    return { message: "New Leader Accepted" };
  });

  // Server call primary server to get the raft state
  mainServer.get("/raft-state", async (request, reply) => {
    const raftState = node.RAFTConsensus.saveFile();
    return reply.code(200).send({ raftState });
  });
};
