import type { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';

/**
 * Game Service - Handles all game logic including target assignment and eliminations
 */

// ============================================================================
// TARGET ASSIGNMENT SYSTEM
// ============================================================================

/**
 * Assigns targets to all players in a lobby
 * Creates a circular target assignment: Player 1 → Player 2 → Player 3 → ... → Player 1
 *
 * @param lobbyId - The lobby ID to assign targets for
 * @returns Array of players with their assigned targets
 * @throws Error if lobby has fewer than 2 players
 */
export async function assignTargetsForLobby(lobbyId: number) {
  // Fetch all alive players in the lobby
  const players = await prisma.player.findMany({
    where: {
      lobbyId,
      status: 'alive',
    },
    orderBy: { id: 'asc' },
  });

  if (players.length < 2) {
    throw new Error('Cannot assign targets: Need at least 2 players in the lobby');
  }

  // Create circular target assignment
  // Player[i] targets Player[(i+1) % length]
  const updatedPlayers: Player[] = [];

  for (let i = 0; i < players.length; i++) {
    const nextIndex = (i + 1) % players.length;
    const nextTarget = players[nextIndex];

    const updatedPlayer = await prisma.player.update({
      where: { id: players[i].id },
      data: {
        targetId: nextTarget.id,
      },
    });

    updatedPlayers.push(updatedPlayer);
  }

  return updatedPlayers as typeof updatedPlayers;
}

// ============================================================================
// ELIMINATION SYSTEM
// ============================================================================

/**
 * Handles the elimination of a player
 * When Player A eliminates Player B:
 * 1. Player B is marked as eliminated
 * 2. Player A's attacker assignment is recorded
 * 3. Players who had B as their target now get B's target (target inheritance)
 * 4. B's stats are updated
 *
 * @param attackerId - The player who performed the elimination
 * @param victimId - The player who was eliminated
 * @returns Object with elimination details and new targets assigned
 */
export async function eliminatePlayer(attackerId: number, victimId: number) {
  // Fetch both players
  const [attacker, victim] = await Promise.all([
    prisma.player.findUnique({ where: { id: attackerId } }),
    prisma.player.findUnique({ where: { id: victimId } }),
  ]);

  if (!attacker || !victim) {
    throw new Error('Player not found');
  }

  if (victim.status === 'eliminated') {
    throw new Error('Player is already eliminated');
  }

  // Find all players who are targeting the victim
  const playersTargetingVictim = await prisma.player.findMany({
    where: {
      targetId: victimId,
      status: 'alive',
    },
  });

  // 1. Mark victim as eliminated
  const eliminatedPlayer = await prisma.player.update({
    where: { id: victimId },
    data: {
      status: 'eliminated',
      attackerId,
      eliminatedAt: new Date(),
      // Clear the victim's target since they're eliminated
      targetId: null,
    },
  });

  // 2. Update attacker's kill count
  const updatedAttacker = await prisma.player.update({
    where: { id: attackerId },
    data: {
      kills: { increment: 1 },
      // If attacker was targeting the victim, reassign their target
      ...(attacker.targetId === victimId && {
        targetId: victim.targetId, // Attacker now gets victim's target
      }),
    },
  });

  // 3. Reassign targets for all players who were targeting the victim
  // They now get the victim's target
  const reassignedPlayers = await Promise.all(
    playersTargetingVictim.map((player: typeof playersTargetingVictim[number]) =>
      prisma.player.update({
        where: { id: player.id },
        data: {
          targetId: victim.targetId,
        },
      }),
    ),
  );

  // Validate that targets were properly reassigned
  // (e.g., no player left without a target unless they're the only one alive)
  const remainingAlivePlayers = await prisma.player.count({
    where: {
      lobbyId: victim.lobbyId,
      status: 'alive',
    },
  });

  if (remainingAlivePlayers > 1) {
    // Ensure all alive players have a target assigned
    const playersWithoutTarget = await prisma.player.findMany({
      where: {
        lobbyId: victim.lobbyId,
        status: 'alive',
        targetId: null,
      },
    });

    if (playersWithoutTarget.length > 0) {
      console.warn(
        `Warning: ${playersWithoutTarget.length} players don't have targets after elimination`,
      );
    }
  }

  return {
    victim: eliminatedPlayer,
    attacker: updatedAttacker,
    reassignedPlayers,
  };
}

// ============================================================================
// PLAYER QUERIES
// ============================================================================

/**
 * Fetch current player state with full game context
 */
export async function getPlayerState(playerId: number) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      target: {
        select: {
          id: true,
          username: true,
          status: true,
          healthRemaining: true,
        },
      },
      attacker: {
        select: {
          id: true,
          username: true,
        },
      },
      targetedBy: {
        where: { status: 'alive' },
        select: {
          id: true,
          username: true,
        },
      },
      lobby: {
        select: {
          id: true,
          lobbyCode: true,
          lobbyName: true,
          status: true,
          gameTimeLimit: true,
        },
      },
      device: true,
      gameStates: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return player;
}

/**
 * Fetch all players in a lobby with their target info
 */
export async function getLobbyPlayers(lobbyId: number, includeEliminated = false) {
  const players = await prisma.player.findMany({
    where: {
      lobbyId,
      ...(includeEliminated ? {} : { status: 'alive' }),
    },
    include: {
      target: {
        select: {
          id: true,
          username: true,
          status: true,
        },
      },
      targetedBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { kills: 'desc' },
  });

  return players;
}

/**
 * Get leaderboard for a lobby
 */
export async function getLobbyLeaderboard(lobbyId: number) {
  const leaderboard = await prisma.player.findMany({
    where: { lobbyId },
    select: {
      id: true,
      username: true,
      kills: true,
      status: true,
      healthRemaining: true,
      createdAt: true,
      eliminatedAt: true,
    },
    orderBy: [{ kills: 'desc' }, { createdAt: 'asc' }],
  });

  return leaderboard;
}

// ============================================================================
// MISSION & GAME STATE QUERIES
// ============================================================================

/**
 * Create or update game state for a player
 */
export async function updatePlayerGameState(
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
  // Find or create game state
  const existingState = await prisma.gameState.findFirst({
    where: { playerId, lobbyId },
  });

  if (existingState) {
    return prisma.gameState.update({
      where: { id: existingState.id },
      data: {
        eliminations: updates.eliminations ?? existingState.eliminations,
        timeSurvived: updates.timeSurvived ?? existingState.timeSurvived,
        distanceTraveled: updates.distanceTraveled ?? existingState.distanceTraveled,
        accuracy: updates.accuracy ?? existingState.accuracy,
        isAlive: updates.isAlive ?? existingState.isAlive,
        lastKnownLocation: updates.lastKnownLocation ?? existingState.lastKnownLocation,
      },
    });
  }

  return prisma.gameState.create({
    data: {
      playerId,
      lobbyId,
      sessionStartTime: new Date(),
      eliminations: updates.eliminations ?? 0,
      timeSurvived: updates.timeSurvived ?? 0,
      distanceTraveled: updates.distanceTraveled ?? 0,
      accuracy: updates.accuracy ?? 0,
      isAlive: updates.isAlive ?? true,
      lastKnownLocation: updates.lastKnownLocation,
    },
  });
}

/**
 * Get player's current mission
 */
export async function getPlayerMissions(playerId: number, status?: string) {
  return prisma.mission.findMany({
    where: {
      playerId,
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update mission progress
 */
export async function updateMissionProgress(
  missionId: number,
  progress: number,
  completed: boolean = false,
) {
  return prisma.mission.update({
    where: { id: missionId },
    data: {
      progress: Math.min(100, Math.max(0, progress)),
      status: completed ? 'completed' : 'active',
      completedAt: completed ? new Date() : undefined,
    },
  });
}

// ============================================================================
// LOBBY QUERIES
// ============================================================================

/**
 * Get full lobby state with all players and their targets
 */
export async function getLobbyState(lobbyId: number) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      host: true,
      players: {
        include: {
          target: {
            select: {
              id: true,
              username: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return lobby;
}

/**
 * Get game statistics for a lobby
 */
export async function getLobbyStats(lobbyId: number) {
  const [totalPlayers, alivePlayers, eliminatedPlayers] = await Promise.all([
    prisma.player.count({ where: { lobbyId } }),
    prisma.player.count({ where: { lobbyId, status: 'alive' } }),
    prisma.player.count({ where: { lobbyId, status: 'eliminated' } }),
  ]);

  return {
    totalPlayers,
    alivePlayers,
    eliminatedPlayers,
    gameProgress: ((eliminatedPlayers / totalPlayers) * 100).toFixed(2),
  };
}

// ============================================================================
// HEALTH & DAMAGE SYSTEM
// ============================================================================

/**
 * Apply damage to a player
 * Returns true if player is eliminated (health <= 0)
 */
export async function damagePlayer(
  playerId: number,
  damageAmount: number,
  attackerId: number,
): Promise<{ player: Player; eliminated: boolean }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  const newHealth = Math.max(0, player.healthRemaining - damageAmount);
  const isEliminated = newHealth <= 0;

  const updatedPlayer = await prisma.player.update({
    where: { id: playerId },
    data: {
      healthRemaining: newHealth,
    },
  });

  if (isEliminated) {
    await eliminatePlayer(attackerId, playerId);
  }

  return {
    player: updatedPlayer,
    eliminated: isEliminated,
  };
}

/**
 * Heal a player
 */
export async function healPlayer(
  playerId: number,
  healAmount: number,
  maxHealth: number = 100.0,
): Promise<Player> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  return prisma.player.update({
    where: { id: playerId },
    data: {
      healthRemaining: Math.min(maxHealth, player.healthRemaining + healAmount),
    },
  });
}

// ============================================================================
// CLEANUP & VALIDATION
// ============================================================================

/**
 * Validate lobby game state - ensures all alive players have targets
 */
export async function validateLobbyGameState(lobbyId: number): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  const alivePlayers = await prisma.player.findMany({
    where: {
      lobbyId,
      status: 'alive',
    },
  });

  if (alivePlayers.length < 2) {
    if (alivePlayers.length === 1) {
      issues.push('Only one player alive - game should be ended');
    }
    if (alivePlayers.length === 0) {
      issues.push('No players alive - lobby should be marked as ended');
    }
  }

  // Check for players without targets
  const playersWithoutTargets = alivePlayers.filter((p) => !p.targetId);
  if (playersWithoutTargets.length > 0) {
    issues.push(
      `${playersWithoutTargets.length} alive player(s) don't have targets assigned`,
    );
  }

  // Check for circular target dependencies
  const targetGraph = new Map<number, number>();
  for (const player of alivePlayers) {
    if (player.targetId) {
      targetGraph.set(player.id, player.targetId);
    }
  }

  // Check if all targets point to alive players
  for (const [, targetId] of targetGraph) {
    const targetPlayer = alivePlayers.find(
      (p: typeof alivePlayers[number]) => p.id === targetId,
    );
    if (!targetPlayer) {
      issues.push(`Player ${targetId} is targeted but not alive`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * End a lobby and declare winner
 */
export async function endLobby(lobbyId: number) {
  const alivePlayers = await prisma.player.findMany({
    where: {
      lobbyId,
      status: 'alive',
    },
  });

  if (alivePlayers.length !== 1) {
    throw new Error(`Cannot end lobby: ${alivePlayers.length} players still alive`);
  }

  // alivePlayers[0] is the winner
  return prisma.lobby.update({
    where: { id: lobbyId },
    data: {
      status: 'ended',
      endedAt: new Date(),
    },
  });
}

export default {
  // Target assignment
  assignTargetsForLobby,

  // Elimination system
  eliminatePlayer,

  // Player queries
  getPlayerState,
  getLobbyPlayers,
  getLobbyLeaderboard,

  // Mission & game state
  updatePlayerGameState,
  getPlayerMissions,
  updateMissionProgress,

  // Lobby queries
  getLobbyState,
  getLobbyStats,

  // Health system
  damagePlayer,
  healPlayer,

  // Validation & cleanup
  validateLobbyGameState,
  endLobby,
};
