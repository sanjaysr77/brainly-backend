import dotenv from "dotenv";
dotenv.config();
export const JWT_PASSWORD = process.env.JWT_PASSWORD || "your-secret-key"

// console.log(JWT_PASSWORD)


if (!JWT_PASSWORD) {
    throw new Error("JWT_PASSWORD is not defined. Check your .env file.");
}