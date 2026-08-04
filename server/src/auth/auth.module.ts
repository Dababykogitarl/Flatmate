import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Duty, Expense, GroupMembership, Home, Member, SharedGroup } from "../common/entities";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [TypeOrmModule.forFeature([Member, Home, Duty, Expense, SharedGroup, GroupMembership]), JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow("JWT_SECRET"), signOptions: { expiresIn: "7d", issuer: "flatmate-api", audience: "flatmate-web" } }) })],
  controllers: [AuthController], providers: [AuthService, AuthGuard], exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
