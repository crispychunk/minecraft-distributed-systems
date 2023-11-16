const DEV = true;

const BASETIMER = 5000;
const RSYNC_INTERVAL = DEV ? 10000 : 180000;
const HEARTBEAT_INTERVAL = DEV ? 2000 : 5000;
const HEARTBEAT_TIMER = 7000;
const RAFT_ELECTION_TIMER = 15000;
export { BASETIMER, RSYNC_INTERVAL, HEARTBEAT_INTERVAL, HEARTBEAT_TIMER };