import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

const mongoUri = process.env.MONGODB_URL;

if (!mongoUri) {
  throw new Error("MONGODB_URL is not defined in environment variables");
}

@Module({
  imports: [
    MongooseModule.forRoot(mongoUri, {
      dbName: "ai_workspace",
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseMongooseModule {}