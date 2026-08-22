using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DirectoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddConsultantDoctorProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ConsultantDoctors_ConsultantClinicId",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "ConsultantClinicId",
                table: "ConsultantDoctors");

            migrationBuilder.AddColumn<int>(
                name: "DayOff",
                table: "ConsultantDoctors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "ConsultantDoctors",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExperienceYears",
                table: "ConsultantDoctors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "ConsultantDoctors",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LicenseNumber",
                table: "ConsultantDoctors",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Mobile",
                table: "ConsultantDoctors",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "ConsultantDoctors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Qualification",
                table: "ConsultantDoctors",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ConsultantDoctorClinic",
                columns: table => new
                {
                    ClinicsId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultantDoctorId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultantDoctorClinic", x => new { x.ClinicsId, x.ConsultantDoctorId });
                    table.ForeignKey(
                        name: "FK_ConsultantDoctorClinic_ConsultantClinics_ClinicsId",
                        column: x => x.ClinicsId,
                        principalTable: "ConsultantClinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ConsultantDoctorClinic_ConsultantDoctors_ConsultantDoctorId",
                        column: x => x.ConsultantDoctorId,
                        principalTable: "ConsultantDoctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsultantDoctorSessionWindows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultantDoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    WindowName = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    PricePerSession = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultantDoctorSessionWindows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsultantDoctorSessionWindows_ConsultantDoctors_Consultant~",
                        column: x => x.ConsultantDoctorId,
                        principalTable: "ConsultantDoctors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctorClinic_ConsultantDoctorId",
                table: "ConsultantDoctorClinic",
                column: "ConsultantDoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctorSessionWindows_ConsultantDoctorId_WindowName",
                table: "ConsultantDoctorSessionWindows",
                columns: new[] { "ConsultantDoctorId", "WindowName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctorSessionWindows_TenantId",
                table: "ConsultantDoctorSessionWindows",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConsultantDoctorClinic");

            migrationBuilder.DropTable(
                name: "ConsultantDoctorSessionWindows");

            migrationBuilder.DropColumn(
                name: "DayOff",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "LicenseNumber",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "Mobile",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "ConsultantDoctors");

            migrationBuilder.DropColumn(
                name: "Qualification",
                table: "ConsultantDoctors");

            migrationBuilder.AddColumn<Guid>(
                name: "ConsultantClinicId",
                table: "ConsultantDoctors",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctors_ConsultantClinicId",
                table: "ConsultantDoctors",
                column: "ConsultantClinicId");
        }
    }
}
