import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username wajib diisi' })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password wajib diisi' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  newPassword!: string;
}
