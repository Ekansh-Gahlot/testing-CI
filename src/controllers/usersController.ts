import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";

// ============================================================================
// SCHEMA
// ============================================================================

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).default("user"),
});

// ============================================================================
// ERRORS
// ============================================================================

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError("Invalid request payload", 400);
    }

    const { email, role } = parsed.data;

    // Simulate DB call
    const user = {
      id: crypto.randomUUID(),
      email,
      role,
      createdAt: new Date(),
    };

    req.log.info({ userId: user.id }, "User created");

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
}
