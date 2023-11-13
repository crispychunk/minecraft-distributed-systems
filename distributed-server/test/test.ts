import { DistributedServerNode } from "../src/distributedNode/distributedNode";
import { v4 as uuidv4 } from "uuid";

// In network node
const testNode1 = new DistributedServerNode("localhost", 8080, 8081, null, true, true, [], uuidv4());
testNode1.networkNodes = [testNode1.selfNode];
testNode1.start();

const newNode = new DistributedServerNode("localhost", 8082, 8083, null, null, null, null, null);
newNode.start();
