import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { getJwtSecret } from "../config/auth.js";

interface AuthRequest extends Request {
  user?: string | JwtPayload;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: "Token missing" });

  const JWT_SECRET = getJwtSecret();
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const isExpired = err.name === "TokenExpiredError";
      return res
        .status(isExpired ? 401 : 403)
        .json({ message: isExpired ? "Token expired" : "Token invalid or expired" });
    }
    if (decoded !== undefined) req.user = decoded;
    next();
  });
};

export default authenticateToken;
