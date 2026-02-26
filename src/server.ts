import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import dotenv from "dotenv";
import { createUser, AppError } from "./controllers/usersController";

dotenv.config();

const app = express();
const logger = pino({
    level: process.env.LOG_LEVEL || "info",
});

app.use(express.json());
app.use(helmet());
app.use(
    pinoHttp({
        logger,
    })
);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

/* ---------------------------
   Routes
----------------------------*/

app.post("/users", createUser);

/* ---------------------------
   Health Check
----------------------------*/

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
    });
});

/* ---------------------------
   Global Error Handler
----------------------------*/

app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
        logger.error(err);

        if (err instanceof AppError) {
            return res.status(err.statusCode).json({
                success: false,
                message: err.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
);

/* ---------------------------
   Start Server
----------------------------*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});