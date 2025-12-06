/**
 * SupabaseLobbyStore.ts - Supabase-backed lobby management
 *
 * Replaces DatabaseLobbyStore with Supabase (works in React Native!)
 * Same API, but uses Supabase client instead of Prisma
 *
 * Benefits:
 * - Works in React Native (no Node.js modules)
 * - Managed PostgreSQL (no server to run)
 * - Real-time updates (optional)
 * - Free tier is generous
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// CODE GENERATION
// ============================================================================

/**
 * Generate a random 6-character alphanumeric code
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
 * Generate a unique code that doesn't exist in database
 */
async function generateUniqueCode(): Promise<string> {
  let code = generateCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const { data } = await supabase.from('lobby').select('id').eq('lobbyCode', code).single();

    if (!data) {
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
 */
export async function getOrCreateDevice(deviceId: string) {
  try {
    // Try to find existing device
    const { data: existingDevice } = await supabase
      .from('device')
      .select('*')
      .eq('bluetoothId', deviceId)
      .single();

    if (existingDevice) {
      // Update heartbeat
      await supabase.from('device').update({ lastHeartbeat: new Date().toISOString() }).eq('id', existingDevice.id);

      return existingDevice;
    }

    // Create new device
    const { data: newDevice, error } = await supabase
      .from('device')
      .insert([
        {
          bluetoothId: deviceId,
          bluetoothStatus: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return newDevice;
  } catch (error) {
    console.error('Error with device:', error);
    throw error;
  }
}

// ============================================================================
// LOBBY MANAGEMENT
// ============================================================================

/**
 * Create a new lobby with Supabase persistence
 */
export async function createLobby(hostDeviceId: string, hostUsername: string, lobbyName: string) {
  try {
    const code = await generateUniqueCode();

    // Get or create host device
    const hostDevice = await getOrCreateDevice(hostDeviceId);

    // Create lobby
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobby')
      .insert([
        {
          lobbyCode: code,
          lobbyName,
          hostId: hostDevice.id,
          gameTimeLimit: new Date(Date.now() + 3600000).toISOString(),
          status: 'waiting',
        },
      ])
      .select()
      .single();

    if (lobbyError) throw lobbyError;

    // Create host as a player
    const { error: playerError } = await supabase.from('player').insert([
      {
        userId: hostDeviceId,
        username: hostUsername,
        lobbyId: lobby.id,
        deviceId: hostDevice.id,
      },
    ]);

    if (playerError) throw playerError;

    return {
      id: lobby.id,
      code: lobby.lobbyCode,
      name: lobby.lobbyName,
      hostUsername,
      players: [hostUsername],
      createdAt: lobby.createdAt,
    };
  } catch (error) {
    console.error('Error creating lobby:', error);
    throw error;
  }
}

/**
 * Get a lobby by its code
 */
export async function getLobbyByCode(code: string) {
  try {
    const { data: lobby, error } = await supabase
      .from('lobby')
      .select(
        `
        id,
        lobbyCode,
        lobbyName,
        createdAt,
        Player (
          username
        )
      `,
      )
      .eq('lobbyCode', code.toUpperCase())
      .single();

    if (error) throw error;
    if (!lobby) return null;

    const players = lobby.Player?.map((p: any) => p.username) || [];

    return {
      id: lobby.id,
      code: lobby.lobbyCode,
      name: lobby.lobbyName,
      hostUsername: players[0] || 'Unknown',
      players,
      createdAt: lobby.createdAt,
    };
  } catch (error) {
    console.error('Error getting lobby:', error);
    throw error;
  }
}

/**
 * Add a participant to a lobby
 */
export async function addParticipantToLobby(code: string, deviceId: string, username: string) {
  try {
    // Get lobby
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobby')
      .select('id')
      .eq('lobbyCode', code.toUpperCase())
      .single();

    if (lobbyError) throw lobbyError;
    if (!lobby) return null;

    // Get or create device
    const device = await getOrCreateDevice(deviceId);

    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('player')
      .select('id')
      .eq('lobbyId', lobby.id)
      .eq('userId', deviceId)
      .single();

    if (!existingPlayer) {
      // Create new player
      const { error: playerError } = await supabase.from('player').insert([
        {
          userId: deviceId,
          username,
          lobbyId: lobby.id,
          deviceId: device.id,
        },
      ]);

      if (playerError) throw playerError;
    }

    // Fetch updated lobby
    return getLobbyByCode(code);
  } catch (error) {
    console.error('Error adding participant:', error);
    throw error;
  }
}

/**
 * Remove a participant from a lobby
 */
export async function removeParticipantFromLobby(code: string, username: string) {
  try {
    const { data: lobby } = await supabase
      .from('lobby')
      .select('id')
      .eq('lobbyCode', code.toUpperCase())
      .single();

    if (!lobby) return null;

    await supabase.from('player').delete().eq('lobbyId', lobby.id).eq('username', username);

    return getLobbyByCode(code);
  } catch (error) {
    console.error('Error removing participant:', error);
    throw error;
  }
}

/**
 * Get the current active lobby for this device
 */
export async function getCurrentActiveLobby(deviceId: string) {
  try {
    // Get device
    const { data: device } = await supabase
      .from('device')
      .select('id')
      .eq('bluetoothId', deviceId)
      .single();

    if (!device) return null;

    // Get most recent hosted lobby
    const { data: lobby, error } = await supabase
      .from('lobby')
      .select(
        `
        id,
        lobbyCode,
        lobbyName,
        createdAt,
        Player (
          username
        )
      `,
      )
      .eq('hostId', device.id)
      .in('status', ['waiting', 'started'])
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No lobby found
      return null;
    }

    if (!lobby) return null;

    const players = lobby.Player?.map((p: any) => p.username) || [];

    return {
      id: lobby.id,
      code: lobby.lobbyCode,
      name: lobby.lobbyName,
      hostUsername: players[0] || 'Unknown',
      players,
      createdAt: lobby.createdAt,
    };
  } catch (error) {
    console.error('Error getting active lobby:', error);
    return null;
  }
}

/**
 * Start a lobby game
 */
export async function startLobby(code: string) {
  try {
    const { data: lobby, error } = await supabase
      .from('lobby')
      .update({
        status: 'started',
        startedAt: new Date().toISOString(),
      })
      .eq('lobbyCode', code.toUpperCase())
      .select()
      .single();

    if (error) throw error;

    return getLobbyByCode(code);
  } catch (error) {
    console.error('Error starting lobby:', error);
    throw error;
  }
}

/**
 * Close/end a lobby
 */
export async function closeLobby(code: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('lobby')
      .update({
        status: 'ended',
        endedAt: new Date().toISOString(),
      })
      .eq('lobbyCode', code.toUpperCase());

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error closing lobby:', error);
    return false;
  }
}

/**
 * Get all active lobbies
 */
export async function getAllLobbies() {
  try {
    const { data: lobbies, error } = await supabase
      .from('lobby')
      .select(
        `
        id,
        lobbyCode,
        lobbyName,
        createdAt,
        Player (
          username
        )
      `,
      )
      .in('status', ['waiting', 'started'])
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return (lobbies || []).map((lobby: any) => ({
      id: lobby.id,
      code: lobby.lobbyCode,
      name: lobby.lobbyName,
      hostUsername: lobby.Player?.[0]?.username || 'Unknown',
      players: lobby.Player?.map((p: any) => p.username) || [],
      createdAt: lobby.createdAt,
    }));
  } catch (error) {
    console.error('Error getting lobbies:', error);
    return [];
  }
}

/**
 * Get lobby by ID
 */
export async function getLobbyById(lobbyId: number) {
  try {
    const { data: lobby, error } = await supabase
      .from('lobby')
      .select(
        `
        *,
        Player (*)
      `,
      )
      .eq('id', lobbyId)
      .single();

    if (error) throw error;
    return lobby;
  } catch (error) {
    console.error('Error getting lobby by ID:', error);
    return null;
  }
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
};
