import { DistributedServerNode } from "../src/distributedNode/distributedNode";
import { RaftState } from "../src/distributedNode/node/distributedNodeInterface";
import { MinecraftServerAdaptor } from "../src/minecraftServerAdaptor/MinecraftServerAdaptor";

jest.spyOn(MinecraftServerAdaptor, "startMinecraftServer").mockImplementation(() => {
  return true;
});

jest.spyOn(MinecraftServerAdaptor, "shutdownMinecraftServer").mockImplementation(async () => {
  return Promise.resolve();
});

// Test functions for join/leaving/creating networks

describe("DistributedServerNode", () => {
  describe("Constructor", () => {
    it("should create an instance with default values", () => {
      const node = new DistributedServerNode("localhost", 3000, 4000, 5000, false, false, null, null, null, null);
      expect(node).toBeDefined();
      expect(node.isPrimaryNode).toBe(false);
      expect(node.inNetwork).toBe(false);
      expect(node.networkNodes).toHaveLength(1);
      expect(node.rSyncTerm).toBe(0);
    });
  });

  describe("Network Methods", () => {
    let node: DistributedServerNode;

    beforeEach(async () => {
      node = new DistributedServerNode("localhost", 8080, 8090, 8082, null, null, null, null, null, null);
      await node.start();
      console.log("Started server");
    });

    afterEach(async () => {
      if (node) {
        await node.stop();
      }
    });

    it("CreateNetwork update variables", async () => {
      await node.createNetwork();
      console.log("Created network");
      expect(node.RAFTConsensus.state).toBe(RaftState.LEADER);
      expect(node.uuid).not.toBeNull();
      expect(node.networkNodes).toEqual([node.selfNode]);
      expect(node.primaryNode).toEqual(node.selfNode);
      expect(node.heartbeatTimerId).not.toBeNull();
      expect(node.rSyncId).not.toBeNull();
      expect(node.rSyncTerm).toBe(0);
      console.log("Finish expected test");
    });

    it("Join Network update variables for both server", async () => {
      const nodeTwo = new DistributedServerNode("localhost", 8084, 8091, 8085, null, null, null, null, null, null);
      await nodeTwo.start();
      await node.createNetwork();
      await nodeTwo.requestNetwork({ address: "http://localhost:8080" });
      // Run expected Tests
      expect(nodeTwo.inNetwork).toBe(true);
      expect(nodeTwo.primaryNode).toEqual(node.selfNode);
      expect(node.networkNodes).toEqual(nodeTwo.networkNodes);
      expect(node.RAFTConsensus.state).toEqual(RaftState.LEADER);
      expect(nodeTwo.RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
      expect(nodeTwo.rSyncClient).not.toBeNull();
      await nodeTwo.stop();
    });

    it("Leave network removes node from the network", async () => {
      const nodeTwo = new DistributedServerNode("localhost", 8084, 8091, 8085, null, null, null, null, null, null);
      await nodeTwo.start();
      await node.createNetwork();
      await nodeTwo.requestNetwork({ address: "http://localhost:8080" });
      await nodeTwo.requestLeaveNetwork();

      expect(node.networkNodes).toEqual([node.selfNode]);
      expect(nodeTwo.networkNodes).toEqual([]);
      expect(nodeTwo.inNetwork).toBe(false);
      await nodeTwo.stop();
    });

    it("Join, Leave, then network removes node from the network", async () => {
      const nodeTwo = new DistributedServerNode("localhost", 8084, 8091, 8085, null, null, null, null, null, null);
      await nodeTwo.start();
      await node.createNetwork();
      await nodeTwo.requestNetwork({ address: "http://localhost:8080" });
      await nodeTwo.requestLeaveNetwork();

      expect(node.networkNodes).toEqual([node.selfNode]);
      expect(nodeTwo.networkNodes).toEqual([]);
      expect(nodeTwo.inNetwork).toBe(false);

      await nodeTwo.requestNetwork({ address: "http://localhost:8080" });
      expect(nodeTwo.inNetwork).toBe(true);
      expect(nodeTwo.primaryNode).toEqual(node.selfNode);
      expect(node.networkNodes).toEqual(nodeTwo.networkNodes);
      expect(node.RAFTConsensus.state).toEqual(RaftState.LEADER);
      expect(nodeTwo.RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
      expect(nodeTwo.rSyncClient).not.toBeNull();
      await nodeTwo.stop();
    });
  });
});
