import axios, { AxiosError } from "axios";
import { DistributedNode, RAFTSave, RaftState } from "./node/distributedNodeInterface";
import { DistributedServerNode } from "./distributedNode";

interface LogEntry {
  term: number;
  command: string; // Replace with your specific command type
}

export class RAFTconsensus {
  public currentTerm: number;
  public votedFor: string | null;
  public log: LogEntry[];
  public state: RaftState;
  public node: DistributedServerNode;

  constructor(currentTerm: number, votedFor: string, raftState: RaftState, node: DistributedServerNode) {
    this.currentTerm = currentTerm || 0;
    this.votedFor = votedFor || null;
    this.log = [];
    this.state = raftState || RaftState.FOLLOWER;
    this.node = node;
  }

  private requestVote(candidateTerm: number, candidateId: number): boolean {
    // Implement the requestVote RPC logic
    return false; // Placeholder return value
  }

  private appendEntries(leaderTerm: number, leaderId: number): boolean {
    // Implement the appendEntries RPC logic
    return false; // Placeholder return value
  }

  public requestVoteHandler(candidateTerm: number, candidateId: string): boolean {
    if (candidateTerm > this.currentTerm) {
      this.currentTerm = candidateTerm;
      this.votedFor = candidateId;
      this.state = RaftState.FOLLOWER;
      return true;
    }
    return false;
  }

  public appendEntriesHandler(leaderTerm: number, leaderId: number): boolean {
    if (leaderTerm >= this.currentTerm) {
      this.currentTerm = leaderTerm;
      this.votedFor = null;
      this.state = RaftState.FOLLOWER;
      return true;
    }
    return false;
  }

  public startElection(): void {
    if (this.state !== RaftState.LEADER) {
      this.currentTerm += 1;
      this.votedFor = null;
      this.state = RaftState.CANDIDATE;

      // Send RequestVote RPCs to all other nodes

      // If received votes from a majority, become leader
    }
  }

  private sendVoteRequests(node: DistributedNode, positiveResponses: number, totalNodes: number): Promise<boolean> {
    const url = `http://${node.address}:${node.distributedPort}/request-vote`;
    return axios
      .get(url)
      .then(() => {
        if (++positiveResponses > totalNodes / 2) {
          return true; //
        }
        return false;
      })
      .catch((error: AxiosError) => {
        console.error(`Error in GET request to ${url}:`, error.message);
        return false;
      });
  }

  public async propagateVoteRequests(): Promise<void> {
    const totalNodes = this.getAliveNodes(); // excluding itself
    let positiveResponses = 1;

    const requestPromises = totalNodes.map(async (node) => {
      // Don't send to itself

      const response = await this.sendVoteRequests(node, positiveResponses, totalNodes.length);
      if (response) {
        // If the promise resolved early, end Promise.all
        throw new Error("Stop Promise.all");
      }
    });

    try {
      await Promise.all(requestPromises);
      console.log(`${positiveResponses} out of ${totalNodes} nodes responded.`);
    } catch (error) {
      if (error.message !== "Stop Promise.all") {
        console.error("At least one GET request failed:", error.message);
      }
    }
  }

  public getAliveNodes() {
    const totalNodes = this.node.networkNodes.filter((node) => node.alive && node.uuid != this.node.uuid);
    return totalNodes;
  }

  public saveFile(): RAFTSave {
    let save: RAFTSave = {
      currentTerm: this.currentTerm,
      votedFor: this.votedFor,
      state: this.state,
    };
    return save;
  }
}
