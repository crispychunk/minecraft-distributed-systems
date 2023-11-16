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

  private retrycount: number;
  private inElection: boolean;
  private electionTimeoutId: any;

  constructor(currentTerm: number, votedFor: string, raftState: RaftState, node: DistributedServerNode) {
    this.currentTerm = currentTerm || 0;
    this.votedFor = votedFor || null;
    this.log = [];
    this.state = raftState || RaftState.FOLLOWER;
    this.node = node;
    this.retrycount = 0;
    this.inElection = false;
  }

  private requestVote(candidateTerm: number, candidateId: number): boolean {
    // Implement the requestVote RPC logic
    return false; // Placeholder return value
  }

  private appendEntries(leaderTerm: number, leaderId: number): boolean {
    // Implement the appendEntries RPC logic
    return false; // Placeholder return value
  }

  public requestVoteHandler(candidateTerm: number, candidateId: string): any {
    if (candidateTerm > this.currentTerm) {
      this.currentTerm = candidateTerm;
      this.votedFor = candidateId;
      this.state = RaftState.FOLLOWER;
      this.inElection = true;
      this.startElectionTimeout();
      return { accepted: true };
    }
    return { accepted: false, candidateTerm: this.currentTerm, candidateId: this.votedFor };
  }

  private startElectionTimeout() {
    // Clear existing timeout if any
    if (this.electionTimeoutId) {
      clearTimeout(this.electionTimeoutId);
    }

    // Set a new timeout for 10 seconds
    this.electionTimeoutId = setTimeout(() => {
      this.handleElectionTimeout();
    }, 10000); // 10 seconds in milliseconds
  }

  private handleElectionTimeout() {
    // Reset the election state
    this.inElection = false;
    this.node.resetHeartbeatTimer();
    console.log(`${this.node.uuid} detected election timeout`);
  }

  public clearElectionTimeout() {
    clearTimeout(this.electionTimeoutId);
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
    if (this.state !== RaftState.LEADER && this.inElection == false) {
      this.currentTerm += 1;
      this.votedFor = this.node.uuid;
      this.state = RaftState.CANDIDATE;
      this.inElection = true;

      this.propagateVoteRequests();
    }
  }

  public async propagateVoteRequests(): Promise<void> {
    const maxDelay = 15000;
    const baseDelay = Math.pow(2, this.retrycount + 2) * 100;
    const randomFactor = Math.random() + 0.5;
    const backoffDelay = Math.min(baseDelay * randomFactor, maxDelay);

    const totalNodes = this.getAliveNodes();
    const requiredPositiveResponses = Math.ceil(totalNodes.length / 2);
    let positiveResponses = { count: 1, done: false };

    if (positiveResponses.count >= requiredPositiveResponses) {
      this.retrycount = 0;
      console.log(`${this.node.uuid} Elect itself as the new leader as there are only 2 nodes`);
      this.node.assumeLeadership();
    }

    const requestPromises = totalNodes.map(async (node) => {
      // Check the flag and the positive response count before proceeding
      if (node.uuid !== this.node.uuid) {
        return this.sendVoteRequests(node, positiveResponses, requiredPositiveResponses);
      }
    });

    await Promise.allSettled(requestPromises);

    // Check if the positive count is less than required before retrying
    if (positiveResponses.count < requiredPositiveResponses) {
      console.log(positiveResponses.count);
      // TODO
      // Hold off on the election, see why it failed
      // If it's behind a term, update itself first, then retry
      setTimeout(() => {
        console.log("retrying election");
        this.inElection = false;
        this.startElection();
      }, 10000 + backoffDelay);
    }
  }

  private async sendVoteRequests(
    node: DistributedNode,
    positiveResponses: { count: number; done: boolean },
    requiredPositiveResponses: number
  ): Promise<boolean> {
    const url = `http://${node.address}:${node.distributedPort}/request-vote`;
    const body = {
      candidateTerm: this.currentTerm,
      candidateId: this.node.uuid,
    };

    try {
      const response = await axios.put(url, body);
      positiveResponses.count += 1;

      if (positiveResponses.count >= requiredPositiveResponses && !positiveResponses.done) {
        console.log(`${this.node.uuid} elected itself as the new leader`);
        this.state = RaftState.LEADER;
        this.inElection = false;
        this.node.assumeLeadership();
        positiveResponses.done = true;
      }

      return true;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  }

  public getAliveNodes() {
    const totalNodes = this.node.networkNodes.filter((node) => node.alive);
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
