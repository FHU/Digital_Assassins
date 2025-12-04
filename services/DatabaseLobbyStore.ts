/**
 * DatabaseLobbyStore.ts - Database-backed lobby management system
 *
 * Replaces the in-memory LobbyStore with Prisma for persistent storage
 *
 * Manages:
 * - Code generation (6-character alphanumeric)
 * - Lobby creation and retrieval (DATABASE)
 * - Player management (DATABASE)
 * - Device tracking (DATABASE)
 *
 * Data is NOW persisted to PostgreSQL database and survives app reloads
 */

import { prisma } from '@/app/lib/prisma';
import type { Player, Lobby as PrismaLobby, Device } from '@prisma/client';

// Local cache for active lobbies (to reduce DB queries)
// Structure: code → { lobbyId, hostId, players[] }
const activeLobbyCache = new Map<string, { lobbyId: number; players: string[] }>();

// ============================================================================
// CODE GENERATION
// ============================================================================

/**
 * Generate a random 6-character alphanumeric code (A-Z, 0-9)
 */
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique code that doesn't already exist in database
 */
async function generateUniqueCode(): Promise<string> {
  let code = generateCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await prisma.lobby.findUnique({
      where: { lobbyCode: code },
    });

    if (!existing) {
      return code;
    }

    code = generateCode();
    attempts++;
  }

  throw new Error('Failed to generate unique lobby code');
}

// ============================================================================
// DEVICE MANAGEMENT
// ============================================================================

/**
 * Get or create a device for this session
 * Uses device ID to track the physical device
 */
export async function getOrCreateDevice(deviceId: string): Promise<Device> {
  let device = await prisma.device.findUnique({
    where: { bluetoothId: deviceId },
  });

  if (!device) {
    device = await prisma.device.create({
      data: {
        bluetoothId: deviceId,
        bluetoothStatus: false, // Will be updated by Bluetooth hook
      },
    });
  }

  // Update heartbeat
  await prisma.device.update({
    where: { id: device.id },
    data: { lastHeartbeat: new Date() },
  });

  return device;
}

// ============================================================================
// LOBBY MANAGEMENT (DATABASE-BACKED)
// ============================================================================

/**
 * Create a new lobby with database persistence
 *
 * @param hostDeviceId - Unique device identifier for the host
 * @param hostUsername - Host's username
 * @param lobbyName - Display name for the lobby
 * @returns Lobby object with database ID
 */
export async function createLobby(
  hostDeviceId: string,
  hostUsername: string,
  lobbyName: string,
): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
}> {
  const code = await generateUniqueCode();

  // Create device for host if not exists
  const hostDevice = await getOrCreateDevice(hostDeviceId);

  // Create lobby in database
  const lobby = await prisma.lobby.create({
    data: {
      lobbyCode: code,
      lobbyName,
      hostId: hostDevice.id,
      gameTimeLimit: new Date(Date.now() + 3600000), // 1 hour default
      status: 'waiting',
    },
  });

  // Create host as a player in the lobby
  await prisma.player.create({
    data: {
      userId: hostDeviceId,
      username: hostUsername,
      lobbyId: lobby.id,
      deviceId: hostDevice.id,
    },
  });

  // Cache it
  activeLobbyCache.set(code, { lobbyId: lobby.id, players: [hostUsername] });

  return {
    id: lobby.id,
    code: lobby.lobbyCode,
    name: lobby.lobbyName,
    hostUsername,
    players: [hostUsername],
    createdAt: lobby.createdAt.toISOString(),
  };
}

/**
 * Get a lobby by its code (fetches from database)
 */
export async function getLobbyByCode(code: string): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
} | null> {
  const upperCode = code.toUpperCase();

  // Check cache first
  const cached = activeLobbyCache.get(upperCode);
  if (cached) {
    // Fetch fresh player list from DB
    const lobby = await prisma.lobby.findUnique({
      where: { lobbyCode: upperCode },
      include: {
        players: {
          select: { username: true },
        },
      },
    });

    if (lobby) {
      const playerNames = lobby.players.map((p) => p.username);
      activeLobbyCache.set(upperCode, {
        lobbyId: lobby.id,
        players: playerNames,
      });

      return {
        id: lobby.id,
        code: lobby.lobbyCode,
        name: lobby.lobbyName,
        hostUsername: lobby.players[0]?.username || 'Unknown',
        players: playerNames,
        createdAt: lobby.createdAt.toISOString(),
      };
    }
  }

  // Not cached, fetch from DB
  const lobby = await prisma.lobby.findUnique({
    where: { lobbyCode: upperCode },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  if (!lobby) {
    return null;
  }

  const playerNames = lobby.players.map((p) => p.username);
  activeLobbyCache.set(upperCode, {
    lobbyId: lobby.id,
    players: playerNames,
  });

  return {
    id: lobby.id,
    code: lobby.lobbyCode,
    name: lobby.lobbyName,
    hostUsername: lobby.players[0]?.username || 'Unknown',
    players: playerNames,
    createdAt: lobby.createdAt.toISOString(),
  };
}

/**
 * Add a participant to a lobby (stores in database)
 *
 * @param code - Lobby code
 * @param deviceId - Device identifier
 * @param username - Player username
 * @returns Updated lobby or null
 */
export async function addParticipantToLobby(
  code: string,
  deviceId: string,
  username: string,
): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
} | null> {
  const upperCode = code.toUpperCase();

  // Fetch lobby
  const lobby = await prisma.lobby.findUnique({
    where: { lobbyCode: upperCode },
  });

  if (!lobby) {
    return null;
  }

  // Get or create device for player
  const device = await getOrCreateDevice(deviceId);

  // Check if player already in lobby
  const existingPlayer = await prisma.player.findFirst({
    where: {
      lobbyId: lobby.id,
      userId: deviceId,
    },
  });

  if (!existingPlayer) {
    // Create new player
    await prisma.player.create({
      data: {
        userId: deviceId,
        username,
        lobbyId: lobby.id,
        deviceId: device.id,
      },
    });
  }

  // Fetch updated lobby with all players
  const updatedLobby = await prisma.lobby.findUnique({
    where: { id: lobby.id },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  if (!updatedLobby) {
    return null;
  }

  const playerNames = updatedLobby.players.map((p) => p.username);
  activeLobbyCache.set(upperCode, {
    lobbyId: updatedLobby.id,
    players: playerNames,
  });

  return {
    id: updatedLobby.id,
    code: updatedLobby.lobbyCode,
    name: updatedLobby.lobbyName,
    hostUsername: playerNames[0] || 'Unknown',
    players: playerNames,
    createdAt: updatedLobby.createdAt.toISOString(),
  };
}

/**
 * Remove a participant from a lobby
 */
export async function removeParticipantFromLobby(
  code: string,
  username: string,
): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
} | null> {
  const upperCode = code.toUpperCase();

  const lobby = await prisma.lobby.findUnique({
    where: { lobbyCode: upperCode },
  });

  if (!lobby) {
    return null;
  }

  // Remove player from lobby
  await prisma.player.deleteMany({
    where: {
      lobbyId: lobby.id,
      username,
    },
  });

  // Fetch updated lobby
  const updatedLobby = await prisma.lobby.findUnique({
    where: { id: lobby.id },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  if (!updatedLobby) {
    return null;
  }

  const playerNames = updatedLobby.players.map((p) => p.username);
  activeLobbyCache.set(upperCode, {
    lobbyId: updatedLobby.id,
    players: playerNames,
  });

  return {
    id: updatedLobby.id,
    code: updatedLobby.lobbyCode,
    name: updatedLobby.lobbyName,
    hostUsername: playerNames[0] || 'Unknown',
    players: playerNames,
    createdAt: updatedLobby.createdAt.toISOString(),
  };
}

/**
 * Get the current active lobby for this device (for host UI)
 * Returns the most recently created lobby by this device that's still waiting/started
 */
export async function getCurrentActiveLobby(deviceId: string): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
} | null> {
  // Find device
  const device = await prisma.device.findUnique({
    where: { bluetoothId: deviceId },
  });

  if (!device) {
    return null;
  }

  // Find most recent hosted lobby
  const lobby = await prisma.lobby.findFirst({
    where: {
      hostId: device.id,
      status: {
        in: ['waiting', 'started'],
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  if (!lobby) {
    return null;
  }

  const playerNames = lobby.players.map((p) => p.username);
  activeLobbyCache.set(lobby.lobbyCode, {
    lobbyId: lobby.id,
    players: playerNames,
  });

  return {
    id: lobby.id,
    code: lobby.lobbyCode,
    name: lobby.lobbyName,
    hostUsername: playerNames[0] || 'Unknown',
    players: playerNames,
    createdAt: lobby.createdAt.toISOString(),
  };
}

/**
 * Close/end a lobby
 */
export async function closeLobby(code: string): Promise<boolean> {
  const upperCode = code.toUpperCase();

  const lobby = await prisma.lobby.findUnique({
    where: { lobbyCode: upperCode },
  });

  if (!lobby) {
    return false;
  }

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: 'ended', endedAt: new Date() },
  });

  activeLobbyCache.delete(upperCode);
  return true;
}

/**
 * Start a lobby game
 */
export async function startLobby(code: string): Promise<{
  id: number;
  code: string;
  name: string;
  hostUsername: string;
  players: string[];
  createdAt: string;
} | null> {
  const upperCode = code.toUpperCase();

  const lobby = await prisma.lobby.findUnique({
    where: { lobbyCode: upperCode },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  if (!lobby) {
    return null;
  }

  const updatedLobby = await prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: 'started', startedAt: new Date() },
    include: {
      players: {
        select: { username: true },
      },
    },
  });

  const playerNames = updatedLobby.players.map((p) => p.username);

  return {
    id: updatedLobby.id,
    code: updatedLobby.lobbyCode,
    name: updatedLobby.lobbyName,
    hostUsername: playerNames[0] || 'Unknown',
    players: playerNames,
    createdAt: updatedLobby.createdAt.toISOString(),
  };
}

/**
 * Get all active lobbies (for debugging)
 */
export async function getAllLobbies() {
  const lobbies = await prisma.lobby.findMany({
    where: {
      status: {
        in: ['waiting', 'started'],
      },
    },
    include: {
      players: {
        select: { username: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return lobbies.map((lobby) => ({
    id: lobby.id,
    code: lobby.lobbyCode,
    name: lobby.lobbyName,
    hostUsername: lobby.players[0]?.username || 'Unknown',
    players: lobby.players.map((p) => p.username),
    createdAt: lobby.createdAt.toISOString(),
  }));
}

/**
 * Get lobby by ID (returns full Prisma object for game service)
 */
export async function getLobbyById(lobbyId: number) {
  return prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      players: true,
      host: true,
    },
  });
}

/**
 * Clear cache (call after critical DB operations)
 */
export function clearCache(): void {
  activeLobbyCache.clear();
}

export default {
  // Lobby operations
  createLobby,
  getLobbyByCode,
  getLobbyById,
  getCurrentActiveLobby,
  closeLobby,
  startLobby,
  getAllLobbies,

  // Participant operations
  addParticipantToLobby,
  removeParticipantFromLobby,

  // Device operations
  getOrCreateDevice,

  // Utilities
  clearCache,
};
