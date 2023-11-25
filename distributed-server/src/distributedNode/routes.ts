import fs from "fs-extra";
import { DistributedServerNode } from "./distributedNode";

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

  /*
  RSYNC ROUTES

  */
  mainServer.put("/rSync", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }

    if (node.isPrimaryNode) {
      return reply.code(400).send({ error: "Its the primary node!" });
    }
    // Call server via ssh
    node.syncWorlds();

    // Set the current rsync replication term to the specified amount

    return reply.code(200);
  });

  // FILE SYNC

  mainServer.put("/file-change", async (request, reply) => {
    try {
      const { event, filePath, fileContent } = request.body;
      const directoryPath = path.dirname(filePath);
      await fs.ensureDir(directoryPath);
      fs.writeFileSync(filePath, fileContent, "utf-8");
      reply.code(200).send({ message: "File change received and saved successfully" });
    } catch (error) {
      console.error("Error handling file change:", error.message);
      reply.code(500).send({ error: "Internal Server Error" });
    }
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
    node.accepteLeadership(request.body);
    return { message: "New Leader Accepted" };
  });
};
