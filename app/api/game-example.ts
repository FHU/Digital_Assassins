/**
 * Example API Routes for Game Service
 *
 * This file demonstrates how to integrate the game service with API endpoints.
 * In a real app, these would be split into separate route files in app/api/
 *
 * For Expo/React Native, you might use:
 * - Expo Router API routes (if using Expo development server)
 * - External backend (Firebase, Supabase, custom Node server)
 * - Server components with "use server" directives
 *
 * @example Using with server actions (React 19 Server Components):
 *
 * "use server"
 *
 * export async function eliminatePlayerAction(attackerId: number, victimId: number) {
 *   const result = await gameService.eliminatePlayer(attackerId, victimId);
 *   return result;
 * }
 */

import gameService from '@/app/services/gameService';

// ============================================================================
// PLAYER ENDPOINTS
// ============================================================================

/**
 * GET /api/player/:id
 * Fetch current player state
 */
export async function getPlayerHandler(playerId: number) {
  try {
    const playerState = await gameService.getPlayerState(playerId);

    if (!playerState) {
      return {
        success: false,
        error: 'Player not found',
        status: 404,
      };
    }

    return {
      success: true,
      data: playerState,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * POST /api/player/:id/damage
 * Apply damage to a player
 *
 * Body: { damage: number, attackerId: number }
 */
export async function damagePlayerHandler(
  playerId: number,
  damage: number,
  attackerId: number,
) {
  try {
    if (damage < 0) {
      return {
        success: false,
        error: 'Damage must be positive',
        status: 400,
      };
    }

    const result = await gameService.damagePlayer(playerId, damage, attackerId);

    return {
      success: true,
      data: {
        player: result.player,
        eliminated: result.eliminated,
        message: result.eliminated ? 'Player eliminated!' : 'Player damaged',
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * POST /api/player/:id/heal
 * Heal a player
 *
 * Body: { healAmount: number, maxHealth?: number }
 */
export async function healPlayerHandler(
  playerId: number,
  healAmount: number,
  maxHealth: number = 100,
) {
  try {
    if (healAmount < 0) {
      return {
        success: false,
        error: 'Heal amount must be positive',
        status: 400,
      };
    }

    const player = await gameService.healPlayer(playerId, healAmount, maxHealth);

    return {
      success: true,
      data: player,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// LOBBY ENDPOINTS
// ============================================================================

/**
 * GET /api/lobby/:id
 * Get complete lobby state
 */
export async function getLobbyHandler(lobbyId: number) {
  try {
    const lobby = await gameService.getLobbyState(lobbyId);

    if (!lobby) {
      return {
        success: false,
        error: 'Lobby not found',
        status: 404,
      };
    }

    return {
      success: true,
      data: lobby,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * GET /api/lobby/:id/players
 * Get all players in a lobby
 *
 * Query: ?includeEliminated=true
 */
export async function getLobbyPlayersHandler(
  lobbyId: number,
  includeEliminated: boolean = false,
) {
  try {
    const players = await gameService.getLobbyPlayers(lobbyId, includeEliminated);

    return {
      success: true,
      data: {
        count: players.length,
        players,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * GET /api/lobby/:id/leaderboard
 * Get lobby leaderboard
 */
export async function getLeaderboardHandler(lobbyId: number) {
  try {
    const leaderboard = await gameService.getLobbyLeaderboard(lobbyId);

    return {
      success: true,
      data: leaderboard,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * GET /api/lobby/:id/stats
 * Get lobby statistics
 */
export async function getLobbyStatsHandler(lobbyId: number) {
  try {
    const stats = await gameService.getLobbyStats(lobbyId);

    return {
      success: true,
      data: stats,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * POST /api/lobby/:id/start
 * Start lobby game and assign targets
 */
export async function startLobbyHandler(lobbyId: number) {
  try {
    // Validate lobby state first
    const validation = await gameService.validateLobbyGameState(lobbyId);

    if (!validation.isValid) {
      return {
        success: false,
        error: 'Cannot start: ' + validation.issues[0],
        issues: validation.issues,
        status: 400,
      };
    }

    // Assign targets
    const players = await gameService.assignTargetsForLobby(lobbyId);

    return {
      success: true,
      data: {
        message: 'Game started',
        playerCount: players.length,
        players,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * POST /api/lobby/:id/end
 * End lobby when only 1 player remains
 */
export async function endLobbyHandler(lobbyId: number) {
  try {
    const lobby = await gameService.endLobby(lobbyId);

    const leaderboard = await gameService.getLobbyLeaderboard(lobbyId);

    return {
      success: true,
      data: {
        lobby,
        winner: leaderboard[0],
        finalLeaderboard: leaderboard,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// ELIMINATION ENDPOINTS
// ============================================================================

/**
 * POST /api/elimination
 * Handle player elimination
 *
 * Body: { attackerId: number, victimId: number }
 */
export async function eliminatePlayerHandler(attackerId: number, victimId: number) {
  try {
    if (attackerId === victimId) {
      return {
        success: false,
        error: 'Cannot eliminate yourself',
        status: 400,
      };
    }

    const result = await gameService.eliminatePlayer(attackerId, victimId);

    return {
      success: true,
      data: {
        victim: result.victim,
        attacker: result.attacker,
        reassignedCount: result.reassignedPlayers.length,
        message: `${result.attacker.username} eliminated ${result.victim.username}!`,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// MISSION ENDPOINTS
// ============================================================================

/**
 * GET /api/player/:id/missions
 * Get player's missions
 *
 * Query: ?status=active
 */
export async function getPlayerMissionsHandler(
  playerId: number,
  status?: 'active' | 'completed' | 'failed',
) {
  try {
    const missions = await gameService.getPlayerMissions(playerId, status);

    return {
      success: true,
      data: {
        count: missions.length,
        missions,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * POST /api/mission/:id/progress
 * Update mission progress
 *
 * Body: { progress: number, completed: boolean }
 */
export async function updateMissionProgressHandler(
  missionId: number,
  progress: number,
  completed: boolean = false,
) {
  try {
    if (progress < 0 || progress > 100) {
      return {
        success: false,
        error: 'Progress must be between 0 and 100',
        status: 400,
      };
    }

    const mission = await gameService.updateMissionProgress(
      missionId,
      progress,
      completed,
    );

    return {
      success: true,
      data: mission,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// GAME STATE ENDPOINTS
// ============================================================================

/**
 * POST /api/player/:id/game-state
 * Update player's game state statistics
 *
 * Body: {
 *   eliminations?: number,
 *   timeSurvived?: number,
 *   distanceTraveled?: number,
 *   accuracy?: number,
 *   isAlive?: boolean,
 *   lastKnownLocation?: string
 * }
 */
export async function updateGameStateHandler(
  playerId: number,
  lobbyId: number,
  updates: {
    eliminations?: number;
    timeSurvived?: number;
    distanceTraveled?: number;
    accuracy?: number;
    isAlive?: boolean;
    lastKnownLocation?: string;
  },
) {
  try {
    // Validate accuracy if provided
    if (updates.accuracy !== undefined && (updates.accuracy < 0 || updates.accuracy > 100)) {
      return {
        success: false,
        error: 'Accuracy must be between 0 and 100',
        status: 400,
      };
    }

    const gameState = await gameService.updatePlayerGameState(
      playerId,
      lobbyId,
      updates,
    );

    return {
      success: true,
      data: gameState,
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// VALIDATION ENDPOINTS
// ============================================================================

/**
 * GET /api/lobby/:id/validate
 * Validate lobby game state
 */
export async function validateLobbyHandler(lobbyId: number) {
  try {
    const validation = await gameService.validateLobbyGameState(lobbyId);

    return {
      success: true,
      data: {
        isValid: validation.isValid,
        issues: validation.issues,
      },
      status: 200,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

// ============================================================================
// BATCH EXPORTS FOR EASIER TESTING
// ============================================================================

export const gameHandlers = {
  player: {
    get: getPlayerHandler,
    damage: damagePlayerHandler,
    heal: healPlayerHandler,
    getMissions: getPlayerMissionsHandler,
    updateGameState: updateGameStateHandler,
  },
  lobby: {
    get: getLobbyHandler,
    getPlayers: getLobbyPlayersHandler,
    getLeaderboard: getLeaderboardHandler,
    getStats: getLobbyStatsHandler,
    start: startLobbyHandler,
    end: endLobbyHandler,
    validate: validateLobbyHandler,
  },
  elimination: {
    eliminate: eliminatePlayerHandler,
  },
  mission: {
    updateProgress: updateMissionProgressHandler,
  },
};

export default gameHandlers;
