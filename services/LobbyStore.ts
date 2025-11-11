/**
 * LobbyStore.ts - MVP lobby management system
 *
 * Manages:
 * - Code generation (6-character alphanumeric)
 * - Lobby creation and retrieval
 * - Participant management
 *
 * Future: Replace with Firestore/Supabase backend
 */

export interface Participant {
  id: string;
  username: string;
  joinedAt: number;
}

export interface Lobby {
  code: string;
  hostName: string;
  name: string;
  participants: Participant[];
  createdAt: number;
}

// In-memory lobby storage (persists during app session)
const activeLobby = new Map<string, Lobby>();

/**
 * Generate a random 6-character alphanumeric code (A-Z, 0-9)
 */
function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique code that doesn't already exist
 */
function generateUniqueCode(): string {
  let code = generateCode();
  while (activeLobby.has(code)) {
    code = generateCode();
  }
  return code;
}

/**
 * Create a new lobby with an auto-generated code
 */
export function createLobby(hostName: string, lobbyName: string): Lobby {
  const code = generateUniqueCode();
  const hostId = `${hostName}-${Date.now()}`;

  const lobby: Lobby = {
    code,
    hostName,
    name: lobbyName,
    participants: [
      {
        id: hostId,
        username: hostName,
        joinedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
  };

  activeLobby.set(code, lobby);
  return lobby;
}

/**
 * Get a lobby by its 6-digit code
 */
export function getLobbyByCode(code: string): Lobby | null {
  return activeLobby.get(code.toUpperCase()) || null;
}

/**
 * Add a participant to a lobby
 */
export function addParticipantToLobby(
  code: string,
  username: string
): Lobby | null {
  const lobby = getLobbyByCode(code);
  if (!lobby) {
    return null;
  }

  const participantId = `${username}-${Date.now()}`;
  lobby.participants.push({
    id: participantId,
    username,
    joinedAt: Date.now(),
  });

  return lobby;
}

/**
 * Remove a participant from a lobby
 */
export function removeParticipantFromLobby(
  code: string,
  participantId: string
): Lobby | null {
  const lobby = getLobbyByCode(code);
  if (!lobby) {
    return null;
  }

  lobby.participants = lobby.participants.filter((p) => p.id !== participantId);
  return lobby;
}

/**
 * Get the current active lobby (for host)
 * MVP: Returns the first/only active lobby
 */
export function getCurrentActiveLobby(): Lobby | null {
  const lobbies = Array.from(activeLobby.values());
  return lobbies.length > 0 ? lobbies[0] : null;
}

/**
 * Delete/close a lobby (called when host ends game)
 */
export function closeLobby(code: string): boolean {
  return activeLobby.delete(code.toUpperCase());
}

/**
 * Get all active lobbies (for debugging/admin)
 */
export function getAllLobbies(): Lobby[] {
  return Array.from(activeLobby.values());
}
