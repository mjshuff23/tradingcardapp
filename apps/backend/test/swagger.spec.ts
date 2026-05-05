import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";

describe("Swagger document", () => {
  it("includes auth cookie security and the expanded API surfaces", async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = testingModule.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle("Trading Card App API")
      .setDescription("Scan -> review -> confirm workflow for trading cards.")
      .setVersion("1.0")
      .addCookieAuth("trading_card_session")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    expect(document.components?.securitySchemes?.cookie).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "trading_card_session",
    });
    expect(document.paths["/api/v1/auth/login"]?.post).toBeDefined();
    expect(document.paths["/api/v1/auth/signup"]?.post).toBeDefined();
    expect(document.paths["/api/v1/cards"]?.get).toBeDefined();
    expect(document.paths["/api/v1/scans"]?.post?.requestBody).toBeDefined();
    expect(document.components?.schemas?.CardDetailDto).toBeDefined();
    expect(document.components?.schemas?.AuthSessionDto).toBeDefined();

    await app.close();
  });
});
