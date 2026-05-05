import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "../src/auth/dto/login.dto";
import { SignupDto } from "../src/auth/dto/signup.dto";

describe("LoginDto", () => {
  it("transforms email to lowercase and trims whitespace", () => {
    const plain = {
      email: " Collector@Example.COM ",
      password: "anypassword",
    };
    const dto = plainToInstance(LoginDto, plain);
    expect(dto.email).toBe("collector@example.com");
  });

  it("accepts any non-empty password for login", async () => {
    const plain = {
      email: "user@example.com",
      password: "simple",
    };
    const dto = plainToInstance(LoginDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects empty password", async () => {
    const plain = {
      email: "user@example.com",
      password: "",
    };
    const dto = plainToInstance(LoginDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("password");
  });

  it("rejects invalid email", async () => {
    const plain = {
      email: "notanemail",
      password: "anypassword",
    };
    const dto = plainToInstance(LoginDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("email");
  });
});

describe("SignupDto", () => {
  it("transforms email to lowercase and trims whitespace", () => {
    const plain = {
      username: "testuser",
      email: " Collector@Example.COM ",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    expect(dto.email).toBe("collector@example.com");
  });

  it("trims username whitespace", () => {
    const plain = {
      username: "  testuser  ",
      email: "user@example.com",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    expect(dto.username).toBe("testuser");
  });

  it("accepts valid signup with strong password", async () => {
    const plain = {
      username: "valid_user-123",
      email: "user@example.com",
      password: "StrongPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects weak password (no uppercase)", async () => {
    const plain = {
      username: "testuser",
      email: "user@example.com",
      password: "weakpass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === "password");
    expect(passwordError).toBeDefined();
  });

  it("rejects weak password (no lowercase)", async () => {
    const plain = {
      username: "testuser",
      email: "user@example.com",
      password: "WEAKPASS123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === "password");
    expect(passwordError).toBeDefined();
  });

  it("rejects weak password (no number)", async () => {
    const plain = {
      username: "testuser",
      email: "user@example.com",
      password: "WeakPassword!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === "password");
    expect(passwordError).toBeDefined();
  });

  it("rejects weak password (no symbol)", async () => {
    const plain = {
      username: "testuser",
      email: "user@example.com",
      password: "WeakPassword123",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === "password");
    expect(passwordError).toBeDefined();
  });

  it("rejects password shorter than 12 characters", async () => {
    const plain = {
      username: "testuser",
      email: "user@example.com",
      password: "Short1!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === "password");
    expect(passwordError).toBeDefined();
  });

  it("rejects username shorter than 3 characters", async () => {
    const plain = {
      username: "ab",
      email: "user@example.com",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const usernameError = errors.find((e) => e.property === "username");
    expect(usernameError).toBeDefined();
  });

  it("rejects username longer than 24 characters", async () => {
    const plain = {
      username: "a".repeat(25),
      email: "user@example.com",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const usernameError = errors.find((e) => e.property === "username");
    expect(usernameError).toBeDefined();
  });

  it("rejects username with invalid characters", async () => {
    const plain = {
      username: "user@name",
      email: "user@example.com",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const usernameError = errors.find((e) => e.property === "username");
    expect(usernameError).toBeDefined();
  });

  it("accepts username with letters, numbers, underscores, and hyphens", async () => {
    const plain = {
      username: "Valid_User-123",
      email: "user@example.com",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid email", async () => {
    const plain = {
      username: "testuser",
      email: "notanemail",
      password: "ValidPass123!",
    };
    const dto = plainToInstance(SignupDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const emailError = errors.find((e) => e.property === "email");
    expect(emailError).toBeDefined();
  });
});
