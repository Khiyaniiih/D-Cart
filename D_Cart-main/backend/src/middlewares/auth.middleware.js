import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { verifyToken } from "../utils/jwt.js";

export const authenticate = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required.", 401));
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return next(new AppError("User not found.", 401));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError("Invalid or expired token.", 401));
  }
};
