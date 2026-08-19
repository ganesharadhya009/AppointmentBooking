using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchedulingApi.Migrations
{
    /// <inheritdoc />
    public partial class AddDoctorAppointment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DoctorAppointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultantDoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultantClinicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultantServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChildId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AppointmentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AppointmentTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    ConsultationFee = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BookedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorAppointments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DoctorAppointments_TenantId",
                table: "DoctorAppointments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorAppointments_TenantId_ConsultantDoctorId_AppointmentDate_AppointmentTime",
                table: "DoctorAppointments",
                columns: new[] { "TenantId", "ConsultantDoctorId", "AppointmentDate", "AppointmentTime" },
                unique: true,
                filter: "[Status] <> 2");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorAppointments_TenantId_IdempotencyKey",
                table: "DoctorAppointments",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DoctorAppointments");
        }
    }
}
