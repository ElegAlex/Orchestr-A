-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_usedAt_idx" ON "password_reset_tokens"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");
