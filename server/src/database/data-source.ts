import "dotenv/config";
import { DataSource } from "typeorm";
import { AppNotification, Duty, DutyCompletion, Expense, GroupMembership, Home, Member, SharedGroup } from "../common/entities";

export default new DataSource({
  type: "postgres", url: process.env.DATABASE_URL,
  entities: [Home, Member, SharedGroup, GroupMembership, Duty, DutyCompletion, Expense, AppNotification], migrations: ["src/database/migrations/*.ts"],
  synchronize: false, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});
