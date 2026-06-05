-- AddForeignKey
ALTER TABLE "task_raci" ADD CONSTRAINT "task_raci_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
