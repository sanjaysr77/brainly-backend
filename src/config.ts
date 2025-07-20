// test
// import dotenv from "dotenv";
// dotenv.config();

// export const JWT_PASSWORD = process.env.JWT_PASSWORD as String;

//  console.log(JWT_PASSWORD)


// if (!JWT_PASSWORD) {
//     throw new Error("JWT_PASSWORD is not defined. Check your .env file.");
// }

import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_PASSWORD) {
    throw new Error("JWT_PASSWORD is not defined. Check your .env file.");
}

export const JWT_PASSWORD  = process.env.JWT_PASSWORD;

console.log(JWT_PASSWORD);
