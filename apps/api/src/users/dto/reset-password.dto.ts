import { IsString, MinLength, Matches } from 'class-validator';

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/, {
    message: 'Password must contain uppercase, digit, and special character',
  })
  newPassword: string;
}
