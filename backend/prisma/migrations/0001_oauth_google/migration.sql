-- OAuth (Supabase / Google) support.

-- AlterTable: passwordHash becomes optional for OAuth-only accounts.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: link to the Supabase identity + cache the avatar.
ALTER TABLE "users" ADD COLUMN "supabaseUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");
