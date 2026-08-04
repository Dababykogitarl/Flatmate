import { MigrationInterface, QueryRunner } from "typeorm";

export class ProductionFeatures1721700000000 implements MigrationInterface {
  name = "ProductionFeatures1721700000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "members" ADD "googleSubject" text`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_members_google_subject" ON "members" ("googleSubject") WHERE "googleSubject" IS NOT NULL`);
    await queryRunner.query(`
      CREATE TABLE "duty_completions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "dutyId" uuid,
        "homeId" uuid NOT NULL,
        "groupId" uuid,
        "assigneeId" uuid,
        "completedById" uuid,
        "titleSnapshot" character varying NOT NULL,
        "recurrence" character varying NOT NULL,
        "scheduledDueAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "completedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_duty_completions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_duty_completions_home_completed" ON "duty_completions" ("homeId", "completedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_duty_completions_duty_completed" ON "duty_completions" ("dutyId", "completedAt")`);
    await queryRunner.query(`ALTER TABLE "duty_completions" ADD CONSTRAINT "FK_duty_completions_duty" FOREIGN KEY ("dutyId") REFERENCES "duties"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "duty_completions" ADD CONSTRAINT "FK_duty_completions_home" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "duty_completions" ADD CONSTRAINT "FK_duty_completions_assignee" FOREIGN KEY ("assigneeId") REFERENCES "members"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "duty_completions" ADD CONSTRAINT "FK_duty_completions_completed_by" FOREIGN KEY ("completedById") REFERENCES "members"("id") ON DELETE SET NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "duty_completions"`);
    await queryRunner.query(`DROP INDEX "IDX_members_google_subject"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "googleSubject"`);
  }
}
