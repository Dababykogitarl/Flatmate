import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Duty, DutyCompletion, Member } from "../src/common/entities";
import { NotificationsService } from "../src/notifications/notifications.service";
import { DutiesService } from "../src/duties/duties.service";
import { GroupsService } from "../src/groups/groups.service";

describe("DutiesService", () => {
  it("marks a duty complete and notifies the home", async () => {
    const duty = { id: "d1", homeId: "h1", assigneeId: "m1", title: "Trash", dueAt: new Date(), recurrence: "once", completed: false, completedAt: null };
    const repo = { findOne: jest.fn().mockResolvedValue(duty), save: jest.fn(async (value) => value) };
    const completionRepo = { create: jest.fn((value) => value), save: jest.fn(async (value) => value) };
    const notifications = { publish: jest.fn(), removeDutyReminder: jest.fn() };
    const groups = { requireAccess: jest.fn() };
    const module = await Test.createTestingModule({ providers: [DutiesService,
      { provide: getRepositoryToken(Duty), useValue: repo },
      { provide: getRepositoryToken(DutyCompletion), useValue: completionRepo },
      { provide: getRepositoryToken(Member), useValue: { findOne: jest.fn().mockResolvedValue({ id: "m1", joinedAt: new Date() }) } },
      { provide: GroupsService, useValue: groups },
      { provide: NotificationsService, useValue: notifications },
    ] }).compile();
    const result = await module.get(DutiesService).complete("h1", "d1", "m1");
    expect(result.completed).toBe(true);
    expect(notifications.publish).toHaveBeenCalledWith("h1", undefined, "duty.completed", expect.any(Object));
    expect(completionRepo.save).toHaveBeenCalled();
  });

  it("advances a recurring duty and schedules its next reminder", async () => {
    const originalDueAt = new Date(Date.now() + 60 * 60 * 1000);
    const duty = { id: "d2", homeId: "h1", groupId: null, assigneeId: "m1", title: "Kitchen", dueAt: originalDueAt, recurrence: "daily", completed: false, completedAt: null };
    const repo = { findOne: jest.fn().mockResolvedValue(duty), save: jest.fn(async (value) => value) };
    const completionRepo = { create: jest.fn((value) => value), save: jest.fn(async (value) => value) };
    const notifications = { publish: jest.fn(), removeDutyReminder: jest.fn(), scheduleDutyReminder: jest.fn() };
    const module = await Test.createTestingModule({ providers: [DutiesService,
      { provide: getRepositoryToken(Duty), useValue: repo },
      { provide: getRepositoryToken(DutyCompletion), useValue: completionRepo },
      { provide: getRepositoryToken(Member), useValue: { findOne: jest.fn() } },
      { provide: GroupsService, useValue: { requireAccess: jest.fn() } },
      { provide: NotificationsService, useValue: notifications },
    ] }).compile();
    const result = await module.get(DutiesService).complete("h1", "d2", "m1");
    expect(result.completed).toBe(false);
    expect(result.completedAt).toBeNull();
    expect(result.dueAt.getTime()).toBeGreaterThan(originalDueAt.getTime());
    expect(notifications.scheduleDutyReminder).toHaveBeenCalledWith(result);
  });
});
