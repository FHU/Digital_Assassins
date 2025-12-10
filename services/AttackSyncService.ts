/**
 * AttackSyncService.ts - Real-time attack event syncing
 *
 * Handles broadcasting attack events between players:
 * - When Player A marks Player B, Player B sees the "being marked" warning
 * - When Player A attacks Player B, Player B's health updates in real-time
 * - When Player B dodges, Player A's attack is canceled
 */

import { supabase } from './SupabaseLobbyStore';

export interface AttackEvent {
  attackerId: number;
  victimId: number;
  lobbyId: number;
  eventType: 'marked' | 'attacking' | 'damage' | 'dodged';
  damageAmount?: number;
  timestamp: string;
}

class AttackSyncService {
  /**
   * Broadcast that an attacker has marked their target (held mark button for 2s)
   */
  async broadcastMarked(attackerId: number, victimId: number, lobbyId: number): Promise<void> {
    try {
      const event: AttackEvent = {
        attackerId,
        victimId,
        lobbyId,
        eventType: 'marked',
        timestamp: new Date().toISOString(),
      };

      // Insert into attack_events table (we'll create this)
      // For now, we can use the player table to store "being attacked" state
      await supabase
        .from('player')
        .update({
          beingAttackedBy: attackerId,
          markedAt: new Date().toISOString(),
        })
        .eq('id', victimId);

      console.log(`✓ Broadcasted MARKED event: ${attackerId} → ${victimId}`);
    } catch (error) {
      console.error('Error broadcasting marked event:', error);
    }
  }

  /**
   * Broadcast that an attacker is actively attacking (holding attack button)
   */
  async broadcastAttacking(attackerId: number, victimId: number, lobbyId: number): Promise<void> {
    try {
      await supabase
        .from('player')
        .update({
          beingAttackedBy: attackerId,
          attackStartedAt: new Date().toISOString(),
        })
        .eq('id', victimId);

      console.log(`✓ Broadcasted ATTACKING event: ${attackerId} → ${victimId}`);
    } catch (error) {
      console.error('Error broadcasting attacking event:', error);
    }
  }

  /**
   * Broadcast damage dealt to victim
   */
  async broadcastDamage(
    attackerId: number,
    victimId: number,
    lobbyId: number,
    damageAmount: number
  ): Promise<void> {
    try {
      // Damage is already applied via gameService.damagePlayer
      // Just log the event
      console.log(`✓ Damage dealt: ${attackerId} → ${victimId} (${damageAmount}ms)`);
    } catch (error) {
      console.error('Error broadcasting damage:', error);
    }
  }

  /**
   * Broadcast that victim dodged the attack
   */
  async broadcastDodged(attackerId: number, victimId: number, lobbyId: number): Promise<void> {
    try {
      // Clear the "being attacked" state
      await supabase
        .from('player')
        .update({
          beingAttackedBy: null,
          markedAt: null,
          attackStartedAt: null,
        })
        .eq('id', victimId);

      console.log(`✓ Broadcasted DODGED event: ${victimId} dodged ${attackerId}`);

      // TODO: Notify attacker that their target dodged
      // This could be done via a separate "dodge_events" table
    } catch (error) {
      console.error('Error broadcasting dodged event:', error);
    }
  }

  /**
   * Clear attack state (when attack button is released without kill)
   */
  async clearAttackState(victimId: number): Promise<void> {
    try {
      await supabase
        .from('player')
        .update({
          beingAttackedBy: null,
          attackStartedAt: null,
        })
        .eq('id', victimId);

      console.log(`✓ Cleared attack state for player ${victimId}`);
    } catch (error) {
      console.error('Error clearing attack state:', error);
    }
  }

  /**
   * Get the current attack state for a player (who's attacking them)
   */
  async getAttackState(playerId: number) {
    try {
      const { data, error } = await supabase
        .from('player')
        .select('beingAttackedBy, markedAt, attackStartedAt')
        .eq('id', playerId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting attack state:', error);
      return null;
    }
  }
}

// Export singleton instance
export const attackSyncService = new AttackSyncService();
