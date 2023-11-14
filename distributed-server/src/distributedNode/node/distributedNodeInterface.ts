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
