// RAFT CONSENSUS TEST
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
  describe("RAFT CHECK", () => {
    let node: DistributedServerNode;

    beforeEach(async () => {
      node = new DistributedServerNode("localhost", 8100, 8101, null, null, null, null, null, null, null);
      await node.start();
    });

    afterEach(async () => {
      if (node) {
        await node.stop();
      }
    });

    it("Created node is in raftstate leader", async () => {
      await node.createNetwork();
      expect(node.RAFTConsensus.state).toBe(RaftState.LEADER);
    });

    it("Nodes that join are in raft Follow State", async () => {
      await node.createNetwork();
      const nodeTwo = new DistributedServerNode("localhost", 8102, 8103, null, null, null, null, null, null, null);
      await nodeTwo.start();
      await nodeTwo.requestNetwork({ address: "http://localhost:8100" });
      expect(node.RAFTConsensus.state).toEqual(RaftState.LEADER);
      expect(nodeTwo.RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
      await nodeTwo.stop();
    });

    it("Multiple Nodes that join are in raft Follow State", async () => {
      await node.createNetwork();
      const nodeTwo = new DistributedServerNode("localhost", 8102, 8103, null, null, null, null, null, null, null);
      await nodeTwo.start();
      await nodeTwo.requestNetwork({ address: "http://localhost:8100" });
      const nodeThree = new DistributedServerNode("localhost", 8104, 8105, null, null, null, null, null, null, null);
      await nodeThree.start();
      await nodeThree.requestNetwork({ address: "http://localhost:8100" });
      expect(node.RAFTConsensus.state).toEqual(RaftState.LEADER);
      expect(nodeTwo.RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
      //expect(nodeThree.RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
      await nodeTwo.stop();
      await nodeThree.stop();
    });
  });

  describe("RAFT election", () => {
    let nodes = [];
    let startingPort = 8100;

    beforeEach(async () => {
      for (let x = 0; x < 20; x++) {
        let node = new DistributedServerNode(
          "localhost",
          startingPort,
          startingPort + 1,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        );
        await node.start();
        nodes.push(node);
        startingPort = startingPort + 2;
      }
    });

    afterEach(async () => {
      await Promise.all(nodes.map((node) => node.stop()));
    }, 10000);

    it("Handle multiple node joins", async () => {
      await nodes[0].createNetwork();
      expect(nodes[0].RAFTConsensus.state).toEqual(RaftState.LEADER);
      for (let x = 1; x < 20; x++) {
        await nodes[x].requestNetwork({ address: "http://localhost:8100" });
      }
      expect(nodes[0].networkNodes).toHaveLength(20);
      expect(nodes[1].networkNodes).toHaveLength(20);
      expect(nodes[1].RAFTConsensus.state).toEqual(RaftState.FOLLOWER);
    }, 10000);

    it("Expect election to be called", async () => {
      await nodes[0].createNetwork();
      expect(nodes[0].RAFTConsensus.state).toEqual(RaftState.LEADER);
      for (let x = 1; x < 20; x++) {
        await nodes[x].requestNetwork({ address: "http://localhost:8100" });
      }
      await nodes[0].stop();
      const myMethodSpy = jest.spyOn(nodes[1], "handlePrimaryFailure");
      await new Promise((resolve) => setTimeout(resolve, 8000));
      expect(myMethodSpy).toHaveBeenCalled();
      await nodes[0].start();
    }, 15000);
  });
});
