/**
 * gameService.ts - Complete game logic service
 *
 * Handles:
 * - Target assignment (circular distribution)
 * - Target transfer on elimination
 * - Damage & health tracking
 * - Win condition detection
 * - Game statistics
 */

import { supabase } from './SupabaseLobbyStore';

interface PlayerState {
  id: number;
  username: string;
  healthRemaining: number;
  kills: number;
  status: string;
  targetId: number | null;
  attackerId: number | null;
  eliminatedAt: string | null;
  target?: any;
  targetedBy?: any[];
  attacker?: any;
}

interface DamageResult {
  playerId: number;
  damageDealt: number;
  healthRemaining: number;
  eliminated: boolean;
  eliminationData?: {
    victim: any;
    attacker: any;
    reassignedPlayers: any[];
  };
}

interface EliminationResult {
  victim: any;
  attacker: any;
  reassignedPlayers: any[];
}

class GameService {
  /**
   * Assign targets to all players in a lobby using circular distribution
   * Player 1 → Player 2 → Player 3 → ... → Player 1
   */
  async assignTargetsForLobby(lobbyId: number): Promise<void> {
    try {
      // Get all alive players in the lobby
      const { data: players, error: playersError } = await supabase
        .from('player')
        .select('id, username, status')
        .eq('lobbyId', lobbyId)
        .eq('status', 'alive')
        .order('id', { ascending: true });

      if (playersError) throw playersError;
      if (!players || players.length < 2) {
        throw new Error('Need at least 2 players to start game');
      }

      // Assign targets circularly
      for (let i = 0; i < players.length; i++) {
        const targetIndex = (i + 1) % players.length;
        const targetId = players[targetIndex].id;

        const { error: updateError } = await supabase
          .from('player')
          .update({ targetId })
          .eq('id', players[i].id);

        if (updateError) throw updateError;
      }

      console.log(`✓ Targets assigned for ${players.length} players in lobby ${lobbyId}`);
    } catch (error) {
      console.error('Error assigning targets:', error);
      throw error;
    }
  }

  /**
   * Get a player's complete state with target and elimination info
   */
  async getPlayerState(playerId: number): Promise<PlayerState> {
    try {
      // Get player data
      const { data: player, error: playerError } = await supabase
        .from('player')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;
      if (!player) throw new Error(`Player ${playerId} not found`);

      // Get target info
      let target = null;
      if (player.targetId) {
        const { data: targetData } = await supabase
          .from('player')
          .select('id, username, healthRemaining, status')
          .eq('id', player.targetId)
          .single();
        target = targetData;
      }

      // Get players targeting this player
      const { data: targetedBy } = await supabase
        .from('player')
        .select('id, username, status')
        .eq('targetId', playerId);

      // Get attacker info if eliminated
      let attacker = null;
      if (player.attackerId) {
        const { data: attackerData } = await supabase
          .from('player')
          .select('id, username')
          .eq('id', player.attackerId)
          .single();
        attacker = attackerData;
      }

      return {
        ...player,
        target,
        targetedBy: targetedBy || [],
        attacker,
      };
    } catch (error) {
      console.error('Error getting player state:', error);
      throw error;
    }
  }

  /**
   * Apply damage to a player and handle elimination if health <= 0
   */
  async damagePlayer(
    victimId: number,
    damageAmount: number,
    attackerId: number
  ): Promise<DamageResult> {
    try {
      // Get victim's current health
      const { data: victim, error: victimError } = await supabase
        .from('player')
        .select('healthRemaining, lobbyId')
        .eq('id', victimId)
        .single();

      if (victimError) throw victimError;
      if (!victim) throw new Error(`Victim ${victimId} not found`);

      const newHealth = Math.max(0, victim.healthRemaining - damageAmount);

      // Update health
      const { error: updateError } = await supabase
        .from('player')
        .update({ healthRemaining: newHealth })
        .eq('id', victimId);

      if (updateError) throw updateError;

      // Check if eliminated
      let eliminationData = undefined;
      if (newHealth <= 0) {
        eliminationData = await this.eliminatePlayer(attackerId, victimId);
      }

      return {
        playerId: victimId,
        damageDealt: damageAmount,
        healthRemaining: newHealth,
        eliminated: newHealth <= 0,
        eliminationData,
      };
    } catch (error) {
      console.error('Error damaging player:', error);
      throw error;
    }
  }

  /**
   * Eliminate a player and transfer targets
   *
   * When Player A eliminates Player B:
   * 1. B is marked as eliminated
   * 2. All players targeting B now target B's target
   * 3. A's kill count increases
   */
  async eliminatePlayer(attackerId: number, victimId: number): Promise<EliminationResult> {
    try {
      // Get victim data (including their target)
      const { data: victim, error: victimError } = await supabase
        .from('player')
        .select('id, username, targetId, lobbyId')
        .eq('id', victimId)
        .single();

      if (victimError) throw victimError;
      if (!victim) throw new Error(`Victim ${victimId} not found`);

      const victimTarget = victim.targetId;

      // Mark victim as eliminated
      const { error: eliminateError } = await supabase
        .from('player')
        .update({
          status: 'eliminated',
          attackerId,
          eliminatedAt: new Date().toISOString(),
          healthRemaining: 0,
        })
        .eq('id', victimId);

      if (eliminateError) throw eliminateError;

      // Get all players targeting the victim
      const { data: playersTargetingVictim, error: targetingError } = await supabase
        .from('player')
        .select('id')
        .eq('targetId', victimId)
        .eq('status', 'alive');

      if (targetingError) throw targetingError;

      // Transfer targets: all who targeted victim now target victim's target
      const reassignedPlayers = [];
      if (playersTargetingVictim && playersTargetingVictim.length > 0) {
        for (const player of playersTargetingVictim) {
          const { error: reassignError } = await supabase
            .from('player')
            .update({ targetId: victimTarget })
            .eq('id', player.id);

          if (reassignError) throw reassignError;
          reassignedPlayers.push(player.id);
        }
      }

      // Increment attacker's kill count
      const { data: attacker, error: attackerFetchError } = await supabase
        .from('player')
        .select('kills')
        .eq('id', attackerId)
        .single();

      if (attackerFetchError) throw attackerFetchError;

      const { error: killUpdateError } = await supabase
        .from('player')
        .update({ kills: (attacker?.kills || 0) + 1 })
        .eq('id', attackerId);

      if (killUpdateError) throw killUpdateError;

      // Get updated attacker data
      const { data: updatedAttacker } = await supabase
        .from('player')
        .select('*')
        .eq('id', attackerId)
        .single();

      console.log(
        `✓ Player ${victim.username} eliminated by attacker ${attackerId}. Targets reassigned for ${reassignedPlayers.length} players`
      );

      return {
        victim,
        attacker: updatedAttacker,
        reassignedPlayers,
      };
    } catch (error) {
      console.error('Error eliminating player:', error);
      throw error;
    }
  }

  /**
   * Get all players in a lobby
   */
  async getLobbyPlayers(lobbyId: number, includeEliminated: boolean = false) {
    try {
      let query = supabase
        .from('player')
        .select('id, username, healthRemaining, kills, status, targetId')
        .eq('lobbyId', lobbyId);

      if (!includeEliminated) {
        query = query.eq('status', 'alive');
      }

      const { data, error } = await query.order('kills', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting lobby players:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a lobby (sorted by kills)
   */
  async getLobbyLeaderboard(lobbyId: number) {
    try {
      const { data, error } = await supabase
        .from('player')
        .select('id, username, kills, status, healthRemaining, eliminatedAt')
        .eq('lobbyId', lobbyId)
        .order('kills', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get complete lobby state
   */
  async getLobbyState(lobbyId: number) {
    try {
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobby')
        .select('*')
        .eq('id', lobbyId)
        .single();

      if (lobbyError) throw lobbyError;

      const players = await this.getLobbyPlayers(lobbyId, true);

      return {
        ...lobby,
        players,
      };
    } catch (error) {
      console.error('Error getting lobby state:', error);
      throw error;
    }
  }

  /**
   * Get lobby statistics
   */
  async getLobbyStats(lobbyId: number) {
    try {
      const { data: players, error } = await supabase
        .from('player')
        .select('id, status')
        .eq('lobbyId', lobbyId);

      if (error) throw error;
      if (!players) throw new Error('No players found');

      const totalPlayers = players.length;
      const alivePlayers = players.filter((p) => p.status === 'alive').length;
      const eliminatedPlayers = totalPlayers - alivePlayers;

      return {
        totalPlayers,
        alivePlayers,
        eliminatedPlayers,
        gameProgress: ((eliminatedPlayers / totalPlayers) * 100).toFixed(2),
      };
    } catch (error) {
      console.error('Error getting lobby stats:', error);
      throw error;
    }
  }

  /**
   * Update player game state with statistics
   */
  async updatePlayerGameState(
    playerId: number,
    lobbyId: number,
    updates: {
      eliminations?: number;
      timeSurvived?: number;
      distanceTraveled?: number;
      accuracy?: number;
      isAlive?: boolean;
      lastKnownLocation?: string;
    }
  ) {
    try {
      const { data, error } = await supabase
        .from('gamestate')
        .upsert(
          {
            playerId,
            lobbyId,
            sessionStartTime: new Date().toISOString(),
            ...updates,
          },
          { onConflict: 'playerId,lobbyId' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating game state:', error);
      throw error;
    }
  }

  /**
   * Heal a player
   */
  async healPlayer(playerId: number, healAmount: number, maxHealth: number = 100) {
    try {
      const { data: player, error: fetchError } = await supabase
        .from('player')
        .select('healthRemaining')
        .eq('id', playerId)
        .single();

      if (fetchError) throw fetchError;

      const newHealth = Math.min(maxHealth, (player?.healthRemaining || 0) + healAmount);

      const { error: updateError } = await supabase
        .from('player')
        .update({ healthRemaining: newHealth })
        .eq('id', playerId);

      if (updateError) throw updateError;
      return newHealth;
    } catch (error) {
      console.error('Error healing player:', error);
      throw error;
    }
  }

  /**
   * Check if game should end (only 1 alive player) and end it if so
   */
  async checkAndEndGame(lobbyId: number) {
    try {
      const stats = await this.getLobbyStats(lobbyId);

      if (stats.alivePlayers === 1) {
        return await this.endLobby(lobbyId);
      }

      return null;
    } catch (error) {
      console.error('Error checking game end:', error);
      throw error;
    }
  }

  /**
   * End a lobby (mark as ended)
   */
  async endLobby(lobbyId: number) {
    try {
      const { data, error } = await supabase
        .from('lobby')
        .update({
          status: 'ended',
          endedAt: new Date().toISOString(),
        })
        .eq('id', lobbyId)
        .select()
        .single();

      if (error) throw error;
      console.log(`✓ Lobby ${lobbyId} ended`);
      return data;
    } catch (error) {
      console.error('Error ending lobby:', error);
      throw error;
    }
  }

  /**
   * Validate lobby game state (check for orphaned targets, etc)
   */
  async validateLobbyGameState(lobbyId: number) {
    try {
      const issues: string[] = [];

      // Get all players
      const { data: players, error: playersError } = await supabase
        .from('player')
        .select('id, username, status, targetId')
        .eq('lobbyId', lobbyId);

      if (playersError) throw playersError;
      if (!players) return { isValid: true, issues: [] };

      // Check for orphaned targets
      for (const player of players) {
        if (player.targetId && player.status === 'alive') {
          const target = players.find((p) => p.id === player.targetId);
          if (!target) {
            issues.push(`Player ${player.username} targets non-existent player ${player.targetId}`);
          }
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
      };
    } catch (error) {
      console.error('Error validating lobby state:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new GameService();
