import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { RolesGuard } from "./auth/roles.guard";
import { DutiesModule } from "./duties/duties.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { HealthModule } from "./health/health.module";
import { GroupsModule } from "./groups/groups.module";
import { MembersModule } from "./members/members.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({
      type: "postgres", url: config.getOrThrow<string>("DATABASE_URL"), autoLoadEntities: true,
      synchronize: config.get("NODE_ENV") !== "production", logging: config.get("NODE_ENV") === "development",
      ssl: config.get("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : false,
    }) }),
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({
      connection: { url: config.get("REDIS_URL", "redis://localhost:6379") },
    }) }),
    AuthModule, MembersModule, GroupsModule, DutiesModule, ExpensesModule, NotificationsModule, HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
