import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { OnApplicationShutdown } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "bullmq";
import { Kafka, Producer } from "kafkajs";
import { Repository } from "typeorm";
import { AppNotification } from "../common/entities";
import { NotificationGateway } from "./notifications.gateway";

type NotificationEvent = { type: string; homeId: string; groupId: string | null; recipientMemberIds: string[]; payload: Record<string, unknown>; occurredAt: string };

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost implements OnApplicationShutdown {
  private readonly sqs: SQSClient;
  private readonly kafkaProducer: Producer | null;
  private kafkaConnected = false;
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AppNotification) private readonly notifications: Repository<AppNotification>,
    private readonly gateway: NotificationGateway,
  ) {
    super();
    this.sqs = new SQSClient({ region: config.get("AWS_REGION", "us-west-2") });
    const brokers = config.get<string>("KAFKA_BROKERS", "").split(",").map((broker) => broker.trim()).filter(Boolean);
    this.kafkaProducer = config.get("KAFKA_ENABLED", "false") === "true" && brokers.length
      ? new Kafka({ clientId: "flatmate-api", brokers }).producer()
      : null;
  }
  async process(job: Job<NotificationEvent>) {
    if (job.name === "duty.reminder") {
      const title = String(job.data.payload.title ?? "Duty reminder");
      const saved = await this.notifications.save(job.data.recipientMemberIds.map((recipientId) => this.notifications.create({
        homeId: job.data.homeId,
        groupId: job.data.groupId,
        recipientId,
        type: job.data.type,
        title: "Duty reminder",
        message: `${title} is due soon.`,
        payload: job.data.payload,
        readAt: null,
      })));
      this.gateway.notifyMembers(job.data.recipientMemberIds, saved);
    }
    const queueUrl = this.config.get<string>("SQS_NOTIFICATION_QUEUE_URL");
    if (queueUrl) {
      const fifo = queueUrl.endsWith(".fifo");
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl, MessageBody: JSON.stringify(job.data),
        ...(fifo ? { MessageGroupId: job.data.groupId ?? job.data.homeId, MessageDeduplicationId: String(job.id) } : {}),
      }));
      return { delivered: "sqs", type: job.data.type };
    }
    if (this.kafkaProducer) {
      if (!this.kafkaConnected) { await this.kafkaProducer.connect(); this.kafkaConnected = true; }
      await this.kafkaProducer.send({ topic: this.config.get("KAFKA_TOPIC", "flatmate.notifications"), messages: [{ key: job.data.groupId ?? job.data.homeId, value: JSON.stringify(job.data) }] });
      return { delivered: "kafka", type: job.data.type };
    }
    return { delivered: "websocket-only", type: job.data.type };
  }
  async onApplicationShutdown() {
    if (this.kafkaProducer && this.kafkaConnected) await this.kafkaProducer.disconnect();
  }
}
