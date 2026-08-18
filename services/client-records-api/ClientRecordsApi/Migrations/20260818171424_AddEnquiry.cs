using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClientRecordsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddEnquiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Enquiries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ParentMobileNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ParentEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ChildName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ChildDateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    ChildGender = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PreferredTherapy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PreferredLocation = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    State = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Concerns = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DiagnosisReportUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ParentIdCardUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    FollowUpDate = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ConvertedParentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConvertedChildId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Enquiries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Enquiries_TenantId",
                table: "Enquiries",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Enquiries");
        }
    }
}
