// 1. MOCKS (before ANY imports)
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');

  return {
    ...actual,
    default: {
      ...actual.default,
      randomUUID: vi.fn(),
    },
  };
});

// 2. IMPORTS
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { createUser } from '../../controllers/usersController';

// 3. TYPED MOCKS
const mockCrypto = vi.mocked(crypto);


describe('createUser', () => {
  const makeReqResNext = (body: unknown) => {
    const req = {
      body,
      log: {
        info: vi.fn(),
      },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as unknown as NextFunction;

    return { req, res, next };
  };

  beforeEach(() => {
    mockCrypto.randomUUID.mockReturnValue('uuid-test-1');
  });

  it('should_create_user_and_respond_201_when_payload_is_valid', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext({
      email: 'a@example.com',
      password: 'password123',
      role: 'admin',
    });

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(next).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.status).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledTimes(1);
    const jsonArg = (vi.mocked(res.json).mock.calls[0] as unknown[])[0] as {
      success: boolean;
      data: { id: string; email: string; createdAt: Date };
    };

    expect(jsonArg.success).toBe(true);
    expect(jsonArg.data).toMatchObject({
      id: 'uuid-test-1',
      email: 'a@example.com',
    });
    expect(jsonArg.data.createdAt).toBeInstanceOf(Date);

    expect(req.log.info).toHaveBeenCalledWith({ userId: 'uuid-test-1' }, 'User created');
    expect(req.log.info).toHaveBeenCalledTimes(1);
  });

  it('should_return_only_safe_fields_when_payload_is_valid', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext({
      email: 'safe@example.com',
      password: 'password123',
    });

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(next).not.toHaveBeenCalled();

    const jsonArg = (vi.mocked(res.json).mock.calls[0] as unknown[])[0] as {
      success: boolean;
      data: Record<string, unknown>;
    };

    expect(jsonArg.success).toBe(true);
    expect(Object.keys(jsonArg.data).sort()).toEqual(['createdAt', 'email', 'id']);
    expect(jsonArg.data).not.toHaveProperty('passwordHash');
    expect(jsonArg.data).not.toHaveProperty('role');
  });

  it('should_call_next_with_AppError_when_body_is_undefined', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext(undefined);

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (vi.mocked(next).mock.calls[0] as unknown[])[0] as Error & { statusCode?: number };
    expect(err.message).toBe('Invalid request payload');
    expect(err.statusCode).toBe(400);
  });

  it('should_call_next_with_AppError_when_email_is_invalid', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext({
      email: 'not-an-email',
      password: 'password123',
      role: 'user',
    });

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (vi.mocked(next).mock.calls[0] as unknown[])[0] as Error & { statusCode?: number };
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Invalid request payload');
    expect(err.statusCode).toBe(400);
  });

  it('should_call_next_with_AppError_when_password_is_too_short', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext({
      email: 'c@example.com',
      password: 'short',
      role: 'user',
    });

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (vi.mocked(next).mock.calls[0] as unknown[])[0] as Error & { statusCode?: number };
    expect(err.message).toBe('Invalid request payload');
    expect(err.statusCode).toBe(400);
  });

  it('should_call_next_when_crypto_randomUUID_throws', async () => {
    // ARRANGE
    const { req, res, next } = makeReqResNext({
      email: 'd@example.com',
      password: 'password123',
      role: 'user',
    });

    mockCrypto.randomUUID.mockImplementationOnce(() => {
      throw new Error('uuid failed');
    });

    // ACT
    await createUser(req, res, next);

    // ASSERT
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);
    const err = (vi.mocked(next).mock.calls[0] as unknown[])[0] as Error;
    expect(err.message).toBe('uuid failed');
  });
});
