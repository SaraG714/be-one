// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY 3-B  ·  Create UpdateUserDto
// ─────────────────────────────────────────────────────────────────────────────
// Same as CreateUserDto but every field is optional (PATCH semantics).
// ─────────────────────────────────────────────────────────────────────────────

// TODO: your code here

import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  IsEmail,
  IsInt,
  Min,
  Max,
} from 'class-validator';

const UserRoles = ['student', 'teacher', 'admin'] as const;
type UserRoles = (typeof UserRoles)[number];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(UserRoles)
  role?: UserRoles;
}

