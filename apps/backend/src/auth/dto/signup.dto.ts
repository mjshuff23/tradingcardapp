import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class SignupDto {
  @ApiProperty({ example: "collector_jane", minLength: 3, maxLength: 24 })
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Username must contain only letters, numbers, underscores, and hyphens",
  })
  username!: string;

  @ApiProperty({ example: "collector@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, {
    message: "Password must be at least 12 characters long",
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/'`;~]).+$/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol",
  })
  password!: string;
}
