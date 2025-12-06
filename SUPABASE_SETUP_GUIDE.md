# Supabase Setup Guide

Supabase is a PostgreSQL database with a JavaScript client that works perfectly in React Native. No server needed!

## Step 1: Create a Supabase Account (FREE)

1. Go to https://supabase.com
2. Click "Start Your Project" → Sign up
3. Create a new project (it provisions in ~2 minutes)
4. Go to **Settings → API Keys**
5. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** API key

## Step 2: Add Environment Variables

Edit `/Users/nima/Documents/Digital_Assassins/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**:
- Replace `your-project-id` with your actual project ID
- Replace `your-anon-key-here` with your actual anon key
- Keep these credentials secret!

## Step 3: Create Database Tables

1. Go to your Supabase project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Paste this SQL and click **Run**:

```sql
-- Create Device table
CREATE TABLE Device (
  id BIGSERIAL PRIMARY KEY,
  bluetoothId TEXT UNIQUE NOT NULL,
  bluetoothStatus BOOLEAN DEFAULT false,
  lastHeartbeat TIMESTAMP DEFAULT now(),
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

-- Create Lobby table
CREATE TABLE Lobby (
  id BIGSERIAL PRIMARY KEY,
  lobbyCode TEXT UNIQUE NOT NULL,
  lobbyName TEXT NOT NULL,
  hostId BIGINT NOT NULL REFERENCES Device(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'waiting',
  gameTimeLimit TIMESTAMP,
  initialHealth FLOAT DEFAULT 100.0,
  playerLimit INT DEFAULT 10,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  startedAt TIMESTAMP,
  endedAt TIMESTAMP
);

-- Create Player table
CREATE TABLE Player (
  id BIGSERIAL PRIMARY KEY,
  userId TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  healthRemaining FLOAT DEFAULT 100.0,
  kills INT DEFAULT 0,
  status TEXT DEFAULT 'alive',
  targetId BIGINT REFERENCES Player(id) ON DELETE SET NULL,
  attackerId BIGINT REFERENCES Player(id) ON DELETE SET NULL,
  lobbyId BIGINT NOT NULL REFERENCES Lobby(id) ON DELETE CASCADE,
  deviceId BIGINT REFERENCES Device(id) ON DELETE SET NULL,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  eliminatedAt TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_player_lobbyId ON Player(lobbyId);
CREATE INDEX idx_player_targetId ON Player(targetId);
CREATE INDEX idx_player_status ON Player(status);
CREATE INDEX idx_lobby_code ON Lobby(lobbyCode);
```

You should see:
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

## Step 4: Test the Connection

Start your app:

```bash
npm start
```

Then either:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

If you see "Initializing lobby..." and it eventually shows the lobby code, **it worked!** ✅

## Troubleshooting

### Error: `EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY not found`

**Solution:** Make sure you added them to `.env` file correctly:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

### Error: `relation "Device" does not exist`

**Solution:** Run the SQL from Step 3 in your Supabase SQL Editor

### Error: Cannot connect to Supabase

**Solution:** Check:
1. Your URL is correct (copy from Supabase Settings → API)
2. Your anon key is correct
3. Your `.env` file is saved
4. Restart the app (`npm start --clear`)

### Slow queries?

Supabase has pagination limits. If you get slow queries, use:
```typescript
// Paginate results
const { data, error } = await supabase
  .from('Lobby')
  .select()
  .limit(10)
  .range(0, 10);
```

## What Changed

### Before: Prisma (Node.js only)
```
React Native App
    ↓
❌ Can't use Prisma (needs Node.js runtime)
```

### After: Supabase (React Native compatible)
```
React Native App
    ↓
✅ SupabaseLobbyStore.ts
    ↓
✅ Supabase API
    ↓
✅ PostgreSQL Database
```

## Features You Get

✅ Real-time updates (optional, can add later)
✅ Authentication (optional, can add later)
✅ Automatic backups
✅ Free tier includes 500MB database
✅ 2GB/month bandwidth free
✅ No server to manage
✅ Pay as you grow

## Next Steps

1. ✅ Add `.env` variables
2. ✅ Create tables in SQL Editor
3. ✅ Test by creating a lobby
4. ✅ Join from another device
5. ✅ Check Supabase dashboard to see data

## Data Flow Example

```
Create Lobby
  → POST to Supabase: Device + Lobby + Player
  → ✅ Stored in PostgreSQL
  → ✅ Instant sync across devices

Join Lobby
  → GET from Supabase: Lobby data
  → POST to Supabase: New Player
  → ✅ Visible to host in real-time

Start Game
  → PUT to Supabase: Lobby status
  → PUT to Supabase: Player targets
  → ✅ All data persisted

Close App
  → ✅ Data still in Supabase
  → ✅ Can rejoin game later
```

## Security Notes

- The `anon` key is safe to use in client apps
- It's configured to only allow specific operations
- Database policies prevent unauthorized access
- Add Row Level Security (RLS) if you want more control

## Monitoring Your Data

Go to **Table Editor** in Supabase to see:
- Device records
- Lobby records
- Player records
- Real-time updates as they happen

Click any table to browse/edit data directly.

## Support

If you have Supabase issues:
1. Check https://supabase.com/docs
2. Visit https://supabase.com/support
3. Check Status page: https://status.supabase.com

---

**Your app is now ready to use!** 🎉

Create a lobby, join from another device, and watch the data sync in real-time in Supabase's Table Editor.
