import { DistributedServerNode } from "../src/distributedNode/distributedNode";
import { v4 as uuidv4 } from "uuid";

// In network node
const testNode1 = new DistributedServerNode("localhost", 8080, 8081, null, null, null, null, null, 0, null);
testNode1.start();

const newNode = new DistributedServerNode("localhost", 8082, 8083, null, null, null, null, null, 0, null);
newNode.start();

const newNode2 = new DistributedServerNode("localhost", 8090, 8091, null, null, null, null, null, 0, null);
newNode2.start();
