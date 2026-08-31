-- CreateTable
CREATE TABLE "study_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "blockId" TEXT,
    "onDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "study_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'assignment',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sourceUid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_session_userId_onDate_idx" ON "study_session"("userId", "onDate");

-- CreateIndex
CREATE INDEX "study_session_userId_endedAt_idx" ON "study_session"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "deadline_userId_dueAt_idx" ON "deadline"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "deadline_userId_sourceUid_key" ON "deadline"("userId", "sourceUid");

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline" ADD CONSTRAINT "deadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline" ADD CONSTRAINT "deadline_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
