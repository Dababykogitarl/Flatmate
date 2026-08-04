import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser = require("cookie-parser");
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

const authAttempts = new Map<string, { count: number; resetAt: number }>();

function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cache-Control", "no-store");
  next();
}

function authRateLimit(request: Request, response: Response, next: NextFunction) {
  if (!request.path.startsWith("/api/v1/auth") || request.method === "OPTIONS") return next();
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const existing = authAttempts.get(key);
  const record = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + 15 * 60 * 1000 } : existing;
  record.count += 1;
  authAttempts.set(key, record);
  response.setHeader("RateLimit-Limit", "30");
  response.setHeader("RateLimit-Remaining", String(Math.max(0, 30 - record.count)));
  response.setHeader("RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));
  if (record.count > 30) return response.status(429).json({ message: "Too many authentication attempts. Try again later." });
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(authRateLimit);
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000", credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
