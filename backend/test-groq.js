import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

async function testGroqLimits() {
  console.log("Testing Llama-3.3-70b-versatile...");
  try {
    const llm70b = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      maxTokens: 10,
    });
    const res = await llm70b.invoke([new HumanMessage("Hello")]);
    console.log("✅ 70B Model success:", res.content);
  } catch (err) {
    console.error("❌ 70B Model failed:", err.message);
  }

  console.log("\nTesting Llama-3.1-8b-instant...");
  try {
    const llm8b = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      maxTokens: 10,
    });
    const res2 = await llm8b.invoke([new HumanMessage("Hello")]);
    console.log("✅ 8B Model success:", res2.content);
  } catch (err) {
    console.error("❌ 8B Model failed:", err.message);
  }
}

testGroqLimits();
