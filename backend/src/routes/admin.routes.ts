import express from "express";
import authenticateToken from "../middlewares/routesProtection.js";
import {
  getLlmModelHandler,
  setLlmModelHandler,
  testLlmModelHandler,
} from "../controllers/admin/llmModel.controller.js";
import {
  getAiRiskApiKeyHandler,
  setAiRiskApiKeyHandler,
} from "../controllers/admin/aiRiskApiKey.controller.js";

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

adminRouter.get(
  "/services/ai-risk-api-key",
  authenticateToken,
  getAiRiskApiKeyHandler,
);

adminRouter.put(
  "/services/ai-risk-api-key",
  authenticateToken,
  setAiRiskApiKeyHandler,
);

export default adminRouter;
