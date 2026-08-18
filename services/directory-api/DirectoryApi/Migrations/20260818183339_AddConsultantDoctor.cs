using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DirectoryApi.Migrations
{
    /// <inheritdoc />
    public partial class AddConsultantDoctor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConsultantDoctors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ConsultantServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultantClinicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultationFee = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultantDoctors", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctors_ConsultantClinicId",
                table: "ConsultantDoctors",
                column: "ConsultantClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctors_ConsultantServiceId",
                table: "ConsultantDoctors",
                column: "ConsultantServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultantDoctors_TenantId",
                table: "ConsultantDoctors",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConsultantDoctors");
        }
    }
}
