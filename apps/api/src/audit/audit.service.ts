import { Injectable, Logger } from '@nestjs/common';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  REGISTER = 'REGISTER',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_CHANGE = 'ROLE_CHANGE',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('SecurityAudit');

  log(event: {
    action: AuditAction;
    userId?: string;
    targetId?: string;
    ip?: string;
    details?: string;
    success: boolean;
  }) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    if (event.success) {
      this.logger.log(JSON.stringify(entry));
    } else {
      this.logger.warn(JSON.stringify(entry));
    }
  }
}
