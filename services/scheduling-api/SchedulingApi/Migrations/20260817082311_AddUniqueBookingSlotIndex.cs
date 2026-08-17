using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchedulingApi.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueBookingSlotIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TenantId_BranchId_TherapistId_TherapyTypeId_AppointmentDate_WindowName",
                table: "Appointments",
                columns: new[] { "TenantId", "BranchId", "TherapistId", "TherapyTypeId", "AppointmentDate", "WindowName" },
                unique: true,
                filter: "[Status] <> 2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Appointments_TenantId_BranchId_TherapistId_TherapyTypeId_AppointmentDate_WindowName",
                table: "Appointments");
        }
    }
}
