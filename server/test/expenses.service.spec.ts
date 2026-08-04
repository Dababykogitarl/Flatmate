import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Expense, Member } from "../src/common/entities";
import { ExpensesService } from "../src/expenses/expenses.service";
import { NotificationsService } from "../src/notifications/notifications.service";

describe("ExpensesService", () => {
  it("splits an expense across every home member and publishes an event", async () => {
    const members = [{ id: "m1" }, { id: "m2" }, { id: "m3" }, { id: "m4" }];
    const expenseRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: "e1", createdAt: new Date(), ...value })),
    };
    const memberRepo = { find: jest.fn().mockResolvedValue(members) };
    const notifications = { publish: jest.fn() };
    const module = await Test.createTestingModule({ providers: [
      ExpensesService,
      { provide: getRepositoryToken(Expense), useValue: expenseRepo },
      { provide: getRepositoryToken(Member), useValue: memberRepo },
      { provide: NotificationsService, useValue: notifications },
    ] }).compile();

    const result = await module.get(ExpensesService).create("h1", "m1", "Groceries", 10);
    expect(result.splits).toHaveLength(4);
    expect(result.splits.map((split) => split.amount)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(notifications.publish).toHaveBeenCalledWith("h1", null, "expense.created", expect.any(Object));
  });

  it("lets an owing member mark their own share paid", async () => {
    const expense = { id: "e1", homeId: "h1", paidById: "m1", title: "Groceries", splits: [
      { memberId: "m1", amount: 5, settled: true },
      { memberId: "m2", amount: 5, settled: false },
    ] };
    const expenseRepo = {
      findOne: jest.fn().mockResolvedValue(expense),
      save: jest.fn(async (value) => value),
    };
    const notifications = { publish: jest.fn() };
    const module = await Test.createTestingModule({ providers: [
      ExpensesService,
      { provide: getRepositoryToken(Expense), useValue: expenseRepo },
      { provide: getRepositoryToken(Member), useValue: { findOne: jest.fn() } },
      { provide: NotificationsService, useValue: notifications },
    ] }).compile();
    const result = await module.get(ExpensesService).settle("h1", "m2", "e1", "m2");
    expect(result.splits[1].settled).toBe(true);
    expect(result.splits[1].settledAt).toEqual(expect.any(String));
    expect(notifications.publish).toHaveBeenCalledWith("h1", null, "expense.settled", expect.any(Object));
  });
});
