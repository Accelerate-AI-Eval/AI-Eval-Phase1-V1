import express from "express";
import authenticateToken from "../middlewares/routesProtection.js";
import {
  getLlmModelHandler,
  setLlmModelHandler,
  testLlmModelHandler,
} from "../controllers/admin/llmModel.controller.js";

const adminRouter = express.Router();

adminRouter.get(
  "/services/llm-model",
  authenticateToken,
  getLlmModelHandler,
);

adminRouter.put(
  "/services/llm-model",
  authenticateToken,
  setLlmModelHandler,
);

adminRouter.post(
  "/services/llm-model/test",
  authenticateToken,
  testLlmModelHandler,
);

export default adminRouter;
