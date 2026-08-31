-- AlterTable
ALTER TABLE "alert_pref" ADD COLUMN     "classLeadMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "classReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "course" ADD COLUMN     "groupFilter" TEXT;

-- CreateTable
CREATE TABLE "calendar_feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "uid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Class',
    "groupLabel" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_userId_key" ON "calendar_feed"("userId");

-- CreateIndex
CREATE INDEX "class_event_userId_startsAt_idx" ON "class_event"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "class_event_userId_uid_key" ON "class_event"("userId", "uid");

-- AddForeignKey
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_event" ADD CONSTRAINT "class_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_event" ADD CONSTRAINT "class_event_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
