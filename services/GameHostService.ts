import { supabase } from "@/services/SupabaseLobbyStore";

/**
 * Service for host-side game management
 * Handles game state transitions and cleanup
 */

interface GameStats {
  totalPlayers: number;
  alivePlayers: number;
  eliminatedPlayers: number;
}

class GameHostService {
  /**
   * Get current game statistics for a lobby
   */
  async getGameStats(lobbyId: number): Promise<GameStats> {
    try {
      const { data: players, error } = await supabase
        .from("player")
        .select("status")
        .eq("lobbyId", lobbyId);

      if (error) throw error;

      const totalPlayers = players?.length || 0;
      const alivePlayers = players?.filter((p) => p.status === "alive").length || 0;
      const eliminatedPlayers = totalPlayers - alivePlayers;

      return { totalPlayers, alivePlayers, eliminatedPlayers };
    } catch (error) {
      console.error("Error getting game stats:", error);
      return { totalPlayers: 0, alivePlayers: 0, eliminatedPlayers: 0 };
    }
  }

  /**
   * Get list of alive players
   */
  async getAlivePlayers(lobbyId: number) {
    try {
      const { data: players, error } = await supabase
        .from("player")
        .select("id, username, healthRemaining, status")
        .eq("lobbyId", lobbyId)
        .eq("status", "alive")
        .order("healthRemaining", { ascending: false });

      if (error) throw error;
      return players || [];
    } catch (error) {
      console.error("Error getting alive players:", error);
      return [];
    }
  }

  /**
   * End the game and clean up database
   * 1. Update lobby status to 'ended'
   * 2. Delete all player records
   * 3. Delete the lobby
   */
  async endGame(lobbyId: number): Promise<boolean> {
    try {
      console.log(`🛑 Ending game for lobby ${lobbyId}...`);

      // Step 1: Update lobby status to 'ended'
      const { error: updateError } = await supabase
        .from("lobby")
        .update({
          status: "ended",
          endedAt: new Date().toISOString(),
        })
        .eq("id", lobbyId);

      if (updateError) throw updateError;
      console.log("✓ Lobby marked as ended");

      // Step 2: Delete all players in this lobby
      const { error: deletePlayersError } = await supabase
        .from("player")
        .delete()
        .eq("lobbyId", lobbyId);

      if (deletePlayersError) throw deletePlayersError;
      console.log("✓ All players deleted");

      // Step 3: Delete the lobby itself
      const { error: deleteLobbyError } = await supabase
        .from("lobby")
        .delete()
        .eq("id", lobbyId);

      if (deleteLobbyError) throw deleteLobbyError;
      console.log("✓ Lobby deleted");

      console.log("✓ Game cleanup complete!");
      return true;
    } catch (error) {
      console.error("Error ending game:", error);
      return false;
    }
  }

  /**
   * Notify all players that the game has ended
   * This is done by updating lobby status to 'ended'
   * Players will be subscribed to this change and can react accordingly
   */
  async notifyGameEnded(lobbyId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from("lobby")
        .update({
          status: "ended",
          endedAt: new Date().toISOString(),
        })
        .eq("id", lobbyId);

      if (error) throw error;
      console.log("✓ Game ended notification sent to all players");
    } catch (error) {
      console.error("Error notifying game end:", error);
    }
  }

  /**
   * Check if the game should end (only 1 player alive)
   */
  async shouldGameEnd(lobbyId: number): Promise<boolean> {
    try {
      const stats = await this.getGameStats(lobbyId);
      return stats.alivePlayers <= 1;
    } catch (error) {
      console.error("Error checking if game should end:", error);
      return false;
    }
  }
}

export default new GameHostService();
