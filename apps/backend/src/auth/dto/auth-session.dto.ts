import { ApiProperty } from "@nestjs/swagger";
import { AuthUserDto } from "./auth-user.dto";

export class AuthSessionDto {
  @ApiProperty()
  authenticated!: boolean;

  @ApiProperty({ type: AuthUserDto, nullable: true })
  user!: AuthUserDto | null;
}
