import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";

// ============================================================================
// SCHEMA
// ============================================================================

// Role is NOT accepted from the client — assigned server-side to prevent privilege escalation
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
// HELPERS
// ============================================================================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
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

    const { email, password } = parsed.data;
    const passwordHash = hashPassword(password);

    // Simulate DB call — role is always "user" for new sign-ups
    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      role: "user" as const,
      createdAt: new Date(),
    };

    req.log.info({ userId: user.id }, "User created");

    // Return only safe fields — never expose passwordHash or internal flags
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
