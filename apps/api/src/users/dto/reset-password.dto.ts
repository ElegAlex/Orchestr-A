import { IsStrongPassword } from '../../common/validators/password-policy';

export class AdminResetPasswordDto {
  @IsStrongPassword()
  newPassword: string;
}
