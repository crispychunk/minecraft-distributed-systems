package org.distributed;

import io.javalin.Javalin;
import org.bukkit.Bukkit;
import org.bukkit.WorldCreator;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.World;

public class DistributedServerPlugin extends JavaPlugin {
    private Javalin app;

    @Override
    public void onEnable() {
        app = Javalin.create().start(8085); // Start the server on port 8085

        app.get("/", ctx -> ctx.result("Hello, Minecraft Javalin Plugin!"));

        app.get("/save", ctx -> {
            // Broadcast a message to all players before saving
//            Bukkit.broadcastMessage("Saving the world. Please be patient...");

            Bukkit.getScheduler().runTask(this, () -> {
                for (World world : Bukkit.getWorlds()) {
                    world.save();
                }

                // Broadcast a message to all players after saving is complete
//            Bukkit.broadcastMessage("Saving is complete!");
                ctx.status(200);
            });

        });


        app.put("/load", ctx -> {
            Bukkit.getScheduler().runTask(this, () -> {
                for (World world : Bukkit.getWorlds()) {
                    WorldCreator worldCreator = new WorldCreator(world.getName());
                    World newWorld = worldCreator.createWorld();
                    if (newWorld != null) {
                        Bukkit.getServer().getWorlds().add(newWorld);
                    }
                };
            });

            ctx.status(200);
        });

        app.put("/unload", ctx -> {
            Bukkit.getScheduler().runTask(this, () -> {
                for (World world : Bukkit.getWorlds()) {
                    Bukkit.unloadWorld(world, true);
                }
            });

            ctx.status(200);
        });


        app.put("/shutdown", ctx -> {
            Bukkit.shutdown();
            ctx.status(200);
        });





    }

    @Override
    public void onDisable() {
        if (app != null) {
            app.stop();
        }
    }

}