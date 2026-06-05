-- DropForeignKey
ALTER TABLE "leave_balances" DROP CONSTRAINT "leave_balances_leaveTypeId_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_thirdPartyId_fkey";

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_thirdPartyId_fkey" FOREIGN KEY ("thirdPartyId") REFERENCES "third_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
