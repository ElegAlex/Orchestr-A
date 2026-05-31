import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import {
  IsStrongPassword,
  validatePasswordStrength,
  assertStrongPassword,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_LENGTH_MESSAGE,
} from './password-policy';

class Probe {
  @IsStrongPassword()
  password!: string;
}

const STRONG = 'P@ssword1';

describe('SEC-007 password policy', () => {
  describe('validatePasswordStrength', () => {
    it('accepts a password meeting the policy', () => {
      expect(validatePasswordStrength(STRONG)).toBeNull();
    });

    it('rejects a too-short password', () => {
      expect(validatePasswordStrength('A1!a')).toBe(PASSWORD_LENGTH_MESSAGE);
    });

    it('rejects an 8+ char password missing complexity classes', () => {
      // long enough, but no uppercase / digit / special character
      expect(validatePasswordStrength('passwordpassword')).toBe(
        PASSWORD_COMPLEXITY_MESSAGE,
      );
    });

    it('does not require a lowercase letter (mirrors the original rule)', () => {
      expect(validatePasswordStrength('PASSWORD1!')).toBeNull();
    });

    it('rejects non-string input', () => {
      expect(validatePasswordStrength(undefined)).toBe(PASSWORD_LENGTH_MESSAGE);
    });
  });

  describe('assertStrongPassword', () => {
    it('throws BadRequestException on a weak password', () => {
      expect(() => assertStrongPassword('a')).toThrow(BadRequestException);
    });

    it('does not throw on a strong password', () => {
      expect(() => assertStrongPassword(STRONG)).not.toThrow();
    });
  });

  describe('@IsStrongPassword() decorator', () => {
    it('produces a validation error for a weak password', async () => {
      const errors = await validate(plainToInstance(Probe, { password: 'a' }));
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toBeDefined();
    });

    it('passes for a strong password', async () => {
      const errors = await validate(
        plainToInstance(Probe, { password: STRONG }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
