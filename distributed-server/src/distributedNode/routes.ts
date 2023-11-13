import { DistributedServerNode } from "./distributedNode";
export const routes = (mainServer, node: DistributedServerNode) => {
  // Base route
  mainServer.get("/", async (request, reply) => {
    return { hello: "world" };
  });

  /* 
  NETWORK ROUTES
  These routes handle join/leaving/creating a network
  */
  // Route for starting a network
  mainServer.post("/network", async (request, reply) => {
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
    node.joinNetwork(request.body);

    return { message: "Requested to join network", data: request.data };
  });

  // Route for primary server to send network info requestor
  mainServer.put("/network", async (request, reply) => {
    // Logic for joining a network goes here
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "This node is not in a network" });
    }
    if (!node.primaryNode) {
      return reply.code(400).send({ error: "This node is not the primary node!" });
    }
    // Send current network info with 200 on success
    const data = 

    return { message: "Joined the network successfully" };
  });

  mainServer.delete("/network", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Already not in the network" });
    }
    // Logic for leaving a network

    return { message: "Network started successfully" };
  });

  /* 
  Distributed Node Routes
  These routes handle adding and removing a node from the list of nodes on the network, useful to determine which node is in the network
  */

  // Use to call the primary server to remove node when the node wants to leave
  mainServer.delete("/nodes", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }

    return { message: "Network started successfully" };
  });

  // Use by the primary server to propogate all nodes with the updated distributed node list
  mainServer.put("/nodes", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }

    return { message: "Network started successfully" };
  });

  /* 
  Heartbeat Routes
    These routes are called to make sure the server is alive. The primary server will call these routes to all other nodes
  */

  mainServer.get("/heartbeat", async (request, reply) => {
    if (!node.inNetwork) {
      return reply.code(400).send({ error: "Not in a network" });
    }

    return { message: "Network started successfully" };
  });

  /* 
  Leadership Routes
   These routes are for leadership elections and proposal 
  */
};
