import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    //const header = req.headers["authorization"];
    const header = req.headers.authorization;
    const decoded = jwt.verify(header as string, JWT_PASSWORD)
    console.log("Decoded");
    console.log(decoded); // Decoded
    //{ id: '68385fcee1d1ff803dc2b7fc', iat: 1748526630 }
    if (decoded) {
        if (typeof decoded === "string") {
            res.status(403).json({
                message: "You are not logged in"
            })
            return;
        }
        req.userId = (decoded as JwtPayload).id;
        next()
    } else {
        res.status(403).json({
            message: "You are not logged in"
        })
    }
}