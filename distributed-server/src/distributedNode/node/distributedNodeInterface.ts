export interface DistributedNode {
  uuid: string;
  address: string;
  distributedPort: number;
  rsyncPort: number;
  minecraftPort: number;
  alive: boolean;
  isPrimary: boolean;
  rSyncTerm: number;
}

export interface RAFTSave {
  currentTerm: number;
  votedFor: string;
  state: RaftState;
}

export enum RaftState {
  FOLLOWER = "follower",
  CANDIDATE = "candidate",
  LEADER = "leader",
}
