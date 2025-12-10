-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "healthRemaining" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'alive',
    "targetId" INTEGER,
    "attackerId" INTEGER,
    "lobbyId" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eliminatedAt" TIMESTAMP(3),

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "bluetoothId" TEXT NOT NULL,
    "bluetoothStatus" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" SERIAL NOT NULL,
    "lobbyCode" VARCHAR(6) NOT NULL,
    "lobbyName" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "gameTimeLimit" TIMESTAMP(3) NOT NULL,
    "initialHealth" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "playerLimit" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "missionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "targetPlayerIdForMission" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameState" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "sessionStartTime" TIMESTAMP(3) NOT NULL,
    "lastUpdateTime" TIMESTAMP(3) NOT NULL,
    "eliminations" INTEGER NOT NULL DEFAULT 0,
    "timeSurvived" INTEGER NOT NULL DEFAULT 0,
    "distanceTraveled" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currentTarget" INTEGER,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "lastKnownLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby_Device" (
    "lobbyId" INTEGER NOT NULL,
    "deviceId" INTEGER NOT NULL,

    CONSTRAINT "Lobby_Device_pkey" PRIMARY KEY ("lobbyId","deviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE INDEX "Player_lobbyId_idx" ON "Player"("lobbyId");

-- CreateIndex
CREATE INDEX "Player_targetId_idx" ON "Player"("targetId");

-- CreateIndex
CREATE INDEX "Player_deviceId_idx" ON "Player"("deviceId");

-- CreateIndex
CREATE INDEX "Player_status_idx" ON "Player"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Device_bluetoothId_key" ON "Device"("bluetoothId");

-- CreateIndex
CREATE INDEX "Device_bluetoothStatus_idx" ON "Device"("bluetoothStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_lobbyCode_key" ON "Lobby"("lobbyCode");

-- CreateIndex
CREATE INDEX "Lobby_lobbyCode_idx" ON "Lobby"("lobbyCode");

-- CreateIndex
CREATE INDEX "Lobby_status_idx" ON "Lobby"("status");

-- CreateIndex
CREATE INDEX "Mission_playerId_idx" ON "Mission"("playerId");

-- CreateIndex
CREATE INDEX "Mission_lobbyId_idx" ON "Mission"("lobbyId");

-- CreateIndex
CREATE INDEX "Mission_status_idx" ON "Mission"("status");

-- CreateIndex
CREATE INDEX "GameState_playerId_idx" ON "GameState"("playerId");

-- CreateIndex
CREATE INDEX "GameState_lobbyId_idx" ON "GameState"("lobbyId");

-- CreateIndex
CREATE INDEX "GameState_isAlive_idx" ON "GameState"("isAlive");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameState" ADD CONSTRAINT "GameState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameState" ADD CONSTRAINT "GameState_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
