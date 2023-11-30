# Minecraft Distributed Systems

Minecraft distributed systems is a program that allows a bunch of server owners to all contribute to a single minecraft server. The goal of this software is to allow any server owner to have a master copy of an up to date minecraft server that they can connect to without worrying about losing their work while playing.

This software is built to be run on LAN due to the nature of router configarations blocking server endpoints. However, you could make this available to the internet via port forwarding. More information can be found below. However, beware of the major security implication of having an expose port and address as there are no checks to incoming connections.

To use this software effecively, I recommend users connect themselves to a VPN. Not only does it provide added security, it allows users to connect to each other without port forwarding.

# Function and Roles

There are 3 main folders in this repo.

### distributed-server
This folder contains functionality for the distributed server. To run the distributed server, go into this folder and first install dependencies using `npm i`.

To run the distributed server run `npm run start`
I have also created a simple gui for the server. To run it, run `npm run gui`

With these 2 processes running, the distributed server is now up and running. Initially, it has no save and it will create a node that is not in a network.

In the gui, there is a create button that allows the user to create its own network. There is a join network that allows a user to join a existing network

There is also leave network that allows the user to leave the network.

### minecraft-distributed-plugin
This is an optional plugin that users can put into their minecraft server that is using spigot, it allows the minecraft server to be accessible via a http server. See spigot development wiki for information about it.

### minecraft-server
This is the actual repo that is being watched by the distributed servers for changes. By default it is using the spigot server files. IMPORTANT: The distributed server will assume that the files already exists in other nodes. By default, the current minecraft server files are provided by default, but if you want to have a custom folder, you will have to fork this repo and have all clients download your forked version with your custom minecraft server files. 


### Goal

The goal of this distributed system is to create a highly available and consistent minecraft server that multiple different clients can all share such that they can all contribute to the same minecraft world even if the original server owner is offline. In short, we would allow minecraft players to play on the SAME minecraft server even though the original server owner has closed their PC. 

To do this, the distributed minecraft server will join a network. This network contains 1 primary node, which is the current server owner and all other nodes are backup nodes that replicate the minecraft server world. If the current server owner shuts down their PC, a backup node will be elected and the same minecraft server will be booted up... in a differnt pc.

As a result, minecraft players can all continue to play in the same minecraft server regardless of the availibity of the original minecraft server. This allows us to minimize downtime in minecraft servers and maximize the fun!


# Internal workings
This is for people analyzing the project.

## Heartbeat
To handle node liveness, we use a ping heartbeat system with the primary sending pings to all nodes in the network. Non primary nodes will have a timer and will detect the primary as having failed. Primary will also detect if backup nodes have failed and propgate it through the network

## Cooridnating a new leader
The primary server is the leader of the network. If it fails, the backup nodes need to elect a new leader. With this, we will use RAFT consensus algorithm. The leader will then propogate its win and become the new primary server

## File sync
Each server node will contain a `fileQueue.json` transactional log. This log determines the state of the minecraft-server folder. The primary server holds the master copy of the transactional log and backup nodes are to compare its state to the master copy. 

To send file overs, the primary node has a watcher on the minecraft-server folder and will detect any file changes. On file changes, it will propogoate those file changes through http requests. Nodes recieving files will log the new file and update their own fileQueue.

## Network
Distributed node are able to join networks. These network define what minecraft server they are all replicating. HTTP requests are done to request,create and leave networks. Each server node holds a networkNodes list which contains information of every single node in its network, who is the primary and what election term it is. Again, like the files, the primary server holds the master copy of the networkNodes.





