import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "collector@example.com" })
  @IsEmail({}, { message: "Please enter a valid email address" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password!: string;
}
