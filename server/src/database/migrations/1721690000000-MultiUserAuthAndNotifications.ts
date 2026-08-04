import { MigrationInterface, QueryRunner } from "typeorm";

export class MultiUserAuthAndNotifications1721690000000 implements MigrationInterface {
  name = "MultiUserAuthAndNotifications1721690000000";

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE "members" ADD "inviteTokenHash" text`);
    await queryRunner.query(`ALTER TABLE "members" ADD "inviteExpiresAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "members" ADD "joinedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`UPDATE "members" SET "joinedAt" = "createdAt" WHERE "passwordHash" IS NOT NULL`);
    await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "homeId" uuid NOT NULL, "groupId" uuid, "recipientId" uuid NOT NULL, "type" character varying NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_notifications" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipientId") REFERENCES "members"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_created" ON "notifications" ("recipientId", "createdAt")`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_created"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_recipient"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "joinedAt"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "inviteExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "inviteTokenHash"`);
  }
}
